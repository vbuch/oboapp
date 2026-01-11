# Terraform Infrastructure as Code

This directory contains Terraform configuration for deploying the ingestion pipeline to Google Cloud.

## Prerequisites

1. **Install Terraform**: https://www.terraform.io/downloads

   ```bash
   brew install terraform  # macOS
   ```

2. **Authenticate with Google Cloud**:

   ```bash
   gcloud auth application-default login
   ```

3. **Set your project**:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

## Quick Start

### 1. Configure Variables

Create `terraform.tfvars` from the example:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
project_id = "your-actual-project-id"
region     = "europe-west1"
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Preview Changes

```bash
terraform plan
```

### 4. Apply Infrastructure

```bash
terraform apply
```

Type `yes` when prompted. This will create:

- Service account with appropriate permissions
- 6 Cloud Run Jobs (4 crawlers + ingest + notify)
- 6 Cloud Scheduler jobs for daily automation
- Enable required Google Cloud APIs

### 5. Build and Deploy Container Image

After Terraform creates the infrastructure:

```bash
cd ..  # back to ingest directory
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/oborishte-ingest:latest
```

### 6. Verify Deployment

```bash
# Test a job
gcloud run jobs execute crawl-rayon-oborishte --region=europe-west1 --wait

# View all jobs
gcloud run jobs list --region=europe-west1

# View schedules
gcloud scheduler jobs list --location=europe-west1
```

## Updating Infrastructure

When you make changes to Terraform files:

```bash
terraform plan   # preview changes
terraform apply  # apply changes
```

## Updating Application Code

When you update the application code:

1. **Build new image**:

   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/oborishte-ingest:v1.0.1
   ```

2. **Update Terraform variable**:

   ```hcl
   # In terraform.tfvars
   image_tag = "v1.0.1"
   ```

3. **Apply changes**:
   ```bash
   terraform apply
   ```

Alternatively, update jobs directly without Terraform:

```bash
gcloud run jobs update crawl-rayon-oborishte \
  --image=gcr.io/YOUR_PROJECT_ID/oborishte-ingest:v1.0.1 \
  --region=europe-west1
```

## Configuration Options

### Variables

All variables are defined in `variables.tf`. Override them in `terraform.tfvars`:

| Variable            | Description            | Default         |
| ------------------- | ---------------------- | --------------- |
| `project_id`        | GCP Project ID         | _required_      |
| `region`            | GCP region             | `europe-west1`  |
| `image_name`        | Docker image name      | `oboapp-ingest` |
| `image_tag`         | Docker image tag       | `latest`        |
| `schedule_timezone` | Timezone for schedules | `Europe/Sofia`  |

### Modifying Schedules

Edit schedules in `main.tf`:

```hcl
locals {
  crawlers = {
    rayon-oborishte = {
      schedule = "0 6 * * *"  # 6 AM daily
      # ... other config
    }
  }
}
```

Cron format: `minute hour day month weekday`

Examples:

- `0 6 * * *` - Daily at 6:00 AM
- `0 6 * * 1` - Weekly on Mondays at 6:00 AM
- `0 */6 * * *` - Every 6 hours
- `30 8 * * 1-5` - Weekdays at 8:30 AM

### Modifying Resources

Change memory/CPU in `main.tf`:

```hcl
resources {
  limits = {
    cpu    = "2"      # Change CPU
    memory = "2Gi"    # Change memory
  }
}
```

## State Management

### Local State (Default)

Terraform state is stored locally in `terraform.tfstate`. **Don't commit this file!**

### Remote State (Recommended for Teams)

Uncomment the backend configuration in `main.tf`:

```hcl
backend "gcs" {
  bucket = "your-terraform-state-bucket"
  prefix = "oborishte-ingest"
}
```

Create the bucket:

```bash
gsutil mb -l europe-west1 gs://your-terraform-state-bucket
gsutil versioning set on gs://your-terraform-state-bucket
```

Then re-initialize:

```bash
terraform init -migrate-state
```

## Common Commands

```bash
# Initialize/upgrade providers
terraform init -upgrade

# Format code
terraform fmt

# Validate configuration
terraform validate

# Show current state
terraform show

# List resources
terraform state list

# Get specific output
terraform output service_account_email

# Destroy all resources (careful!)
terraform destroy
```

## Troubleshooting

### Permission Denied Errors

Ensure you have necessary permissions:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:your-email@example.com" \
  --role="roles/editor"
```

### API Not Enabled

If you get "API not enabled" errors, Terraform should enable them automatically. If not:

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
```

### State Conflicts

If working with a team and state is locked:

```bash
terraform force-unlock LOCK_ID
```

### Jobs Not Running

Check scheduler status:

```bash
gcloud scheduler jobs describe crawl-rayon-oborishte-schedule \
  --location=europe-west1
```

Manually trigger:

```bash
gcloud scheduler jobs run crawl-rayon-oborishte-schedule \
  --location=europe-west1
```

## Cost Optimization

The infrastructure defined here should cost **~$0.60/month**:

- Cloud Run Jobs: FREE (within free tier)
- Cloud Scheduler: $0.10/month × 6 jobs = $0.60/month

To reduce costs further:

1. Reduce schedule frequency (weekly instead of daily)
2. Consolidate jobs where possible
3. Use smaller memory allocations

## Security Best Practices

1. **Never commit** `terraform.tfvars` or `*.tfstate` files
2. Use **remote state** with locking for team collaboration
3. Store **secrets** in Google Secret Manager, not in Terraform:

   ```hcl
   env {
     name = "API_KEY"
     value_source {
       secret_key_ref {
         secret  = "api-key-secret"
         version = "latest"
       }
     }
   }
   ```

4. Use **service account** with minimal permissions
5. Enable **VPC Service Controls** for production

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy Infrastructure
on:
  push:
    branches: [main]
    paths: ["ingest/terraform/**"]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      - name: Terraform Init
        run: terraform init
        working-directory: ingest/terraform
      - name: Terraform Apply
        run: terraform apply -auto-approve
        working-directory: ingest/terraform
        env:
          GOOGLE_CREDENTIALS: ${{ secrets.GCP_CREDENTIALS }}
```
