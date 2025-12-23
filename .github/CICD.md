# GitHub Actions CI/CD Setup

This guide explains how to set up automated deployment using GitHub Actions.

## Overview

The GitHub Actions workflow automatically:

1. Builds Docker image when code changes
2. Pushes image to Google Container Registry
3. Updates Terraform infrastructure
4. All triggered by pushing to `main` branch

## Setup Instructions

### 1. Enable Required APIs

```bash
gcloud services enable iamcredentials.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable sts.googleapis.com
```

### 2. Create Workload Identity Pool

This allows GitHub Actions to authenticate without service account keys:

```bash
PROJECT_ID="your-project-id"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-condition="assertion.repository_owner == 'YOUR_GITHUB_USERNAME'"
```

**Important**: Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username in the command above.

### 3. Create Service Account for GitHub Actions

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions" \
  --project="$PROJECT_ID"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudscheduler.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/viewer"

# Allow GitHub Actions to impersonate this service account
gcloud iam service-accounts add-iam-policy-binding \
  "github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_USERNAME/oborishte-map"
```

**Important**: Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### 4. Get Workload Identity Provider Resource Name

```bash
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

Copy the output (looks like: `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider`)

### 5. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name                      | Value                              | Example                                                |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `GCP_PROJECT_ID`                 | Your GCP project ID                | `oborishte-map`                                        |
| `GCP_SERVICE_ACCOUNT`            | Service account email              | `github-actions@oborishte-map.iam.gserviceaccount.com` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Provider resource name from step 4 | `projects/123.../providers/github-provider`            |

### 6. Create Terraform Backend (Optional but Recommended)

Store Terraform state in GCS for team collaboration:

```bash
# Create bucket for Terraform state
gsutil mb -l europe-west1 gs://$PROJECT_ID-terraform-state
gsutil versioning set on gs://$PROJECT_ID-terraform-state

# Grant GitHub Actions access
gsutil iam ch \
  serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com:objectAdmin \
  gs://$PROJECT_ID-terraform-state
```

Then uncomment the backend block in `terraform/main.tf`:

```hcl
backend "gcs" {
  bucket = "your-project-id-terraform-state"
  prefix = "oborishte-ingest"
}
```

And run locally:

```bash
cd ingest/terraform
terraform init -migrate-state
git add .terraform.lock.hcl
git commit -m "Enable remote state"
```

### 7. Test the Workflow

Push a change to trigger the workflow:

```bash
git add .
git commit -m "Enable CI/CD"
git push origin main
```

Go to your GitHub repository → Actions tab to watch the deployment.

## Workflow Triggers

The workflow runs when:

- Code in `ingest/` directory changes
- The workflow file itself changes
- Manually triggered from Actions tab

## Manual Deployment

You can still deploy manually:

```bash
cd ingest
gcloud builds submit --tag gcr.io/$PROJECT_ID/oborishte-ingest:latest
cd terraform
terraform apply
```

## Troubleshooting

### Authentication Errors

If you see "Error: google: could not find default credentials":

1. Check that secrets are set correctly in GitHub
2. Verify Workload Identity Pool is configured
3. Ensure service account has `roles/iam.workloadIdentityUser`

### Permission Denied

Grant additional roles to the GitHub Actions service account:

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/editor"
```

### Image Not Found

The workflow builds the image before Terraform runs, so this shouldn't happen. If it does:

1. Check Cloud Build logs in GCP Console
2. Verify the image name matches in both the workflow and Terraform

### Terraform State Lock

If state is locked from a previous run:

```bash
cd ingest/terraform
terraform force-unlock LOCK_ID
```

## Cost Implications

GitHub Actions:

- **Free**: 2,000 minutes/month for public repos
- **Private repos**: 500 minutes/month free, then $0.008/minute

Cloud Build:

- **Free**: 120 build-minutes/day
- After: $0.003/build-minute

Total additional cost for CI/CD: **~$0** (within free tiers)

## Advanced: Branch-based Deployments

To deploy different branches to different environments, modify the workflow:

```yaml
on:
  push:
    branches: [main, staging, dev]

jobs:
  build-and-deploy:
    steps:
      # ... auth steps ...

      - name: Set environment based on branch
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "ENV_NAME=prod" >> $GITHUB_ENV
          elif [ "${{ github.ref }}" = "refs/heads/staging" ]; then
            echo "ENV_NAME=staging" >> $GITHUB_ENV
          else
            echo "ENV_NAME=dev" >> $GITHUB_ENV
          fi

      - name: Terraform Apply
        run: |
          cd ingest/terraform
          terraform workspace select $ENV_NAME || terraform workspace new $ENV_NAME
          terraform apply -auto-approve tfplan
```
