# Firebase Service Account Setup

## Overview

Firebase service account keys provide server-side authentication for Firebase Admin SDK operations across different project instances. **Core Behavior**: When deploying the application to multiple environments (development, staging, production), each instance requires its own service account key with appropriate permissions for Firebase operations.

## Creating Service Account Keys

### Google Cloud Console Method

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Configure service account:
   - **Name**: `firebase-admin-[environment]` (e.g., `firebase-admin-staging`)
   - **Description**: Service account for Firebase Admin SDK operations
6. Assign required roles:
   - **Cloud Datastore User** (for Firestore access)
   - **Firebase Cloud Messaging Admin** (for push notifications)
7. Generate private key:
   - Click on the service account email
   - Go to **Keys** tab → **Add Key** → **Create New Key**
   - Select **JSON** format
   - Download the generated key file

## Configuration

### Environment Variable Format

Convert the downloaded JSON key to a single-line string for the environment variable:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
```

## Firestore Index Deployment

### Overview

The application requires custom Firestore indexes for efficient querying of categorized messages. These indexes support features like category-based filtering and relations clustering.

### Required Indexes

The project includes a [`firestore.indexes.json`](./firestore.indexes.json) file with composite indexes.

### Deployment Process

**Important**: Deploy indexes **before** deploying code changes to prevent query failures.

1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init firestore`
4. `firebase deploy --only firestore:indexes`
5. **Monitor deployment**:
   - Visit [Firebase Console](https://console.firebase.google.com/) → Firestore → Indexes
   - Wait for all indexes to show "Enabled" status (can take several minutes)

Do not deploy application code until all indexes show "Enabled" status.
