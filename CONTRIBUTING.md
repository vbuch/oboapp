# Contributing to OboApp

This guide helps new contributors set up the project locally using their own Firebase and Google Cloud accounts.

## Prerequisites

- **Node.js 20.x** (check with `node --version`)
- **npm** package manager
- **Firebase account** (free tier sufficient for development)
- **Google Cloud account** (free tier sufficient for development)

## Project Structure

This is a monorepo with two main directories:

- **`/web`** - Next.js web application (frontend + API routes)
- **`/ingest`** - Data ingestion pipeline (crawlers, AI processing, geocoding)

Both directories require their own `.env.local` configuration.

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., `oboapp-dev`)
4. Disable Google Analytics (optional for development)
5. Click "Create project"

### 2. Enable Authentication

1. In Firebase Console → **Authentication** → "Get started"
2. Click **Sign-in method** tab
3. Enable **Google** provider
4. Set support email
5. Save

### 3. Enable Firestore

1. In Firebase Console → **Firestore Database** → "Create database"
2. Select **Start in test mode** (for development)
3. Choose location (e.g., `europe-west`)
4. Click "Enable"

### 4. Create Test Database

1. In Firestore → Settings (⚙️) → **Databases** tab
2. Click "Create database"
3. Database ID: `oboapp-test`
4. Location: Same as default database
5. Click "Create database"

### 5. Update Security Rules (Development Only)

For local development, set permissive rules on `oboapp-test`:

1. Select `oboapp-test` database
2. Go to **Rules** tab
3. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/oboapp-test/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

4. Publish rules

### 6. Enable Cloud Messaging (Optional - Only needed for Notifications)

1. In Firebase Console → **Cloud Messaging** → "Get started"
2. (No additional setup needed)

### 7. Generate Web Push Certificate (Optional - Only needed for Notifications)

1. In Firebase Console → Project Settings → **Cloud Messaging** tab
2. Scroll to **Web Push certificates**
3. Click "Generate key pair"
4. Copy the key (starts with `B...`)
5. Save as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### 8. Get Firebase Configuration

1. In Firebase Console → Project Settings → **General** tab
2. Scroll to "Your apps" → Web apps
3. If no app exists, click "Add app" (</>) → Register app
4. Copy configuration values:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

### 9. Download Service Account Key (Only for Backend/Crawlers)

1. In Firebase Console → Project Settings → **Service Accounts** tab
2. Click "Generate new private key"
3. Save JSON file securely
4. Convert to single line:
   ```bash
   jq -c . < service-account-key.json
   ```
5. Copy output for `FIREBASE_SERVICE_ACCOUNT_KEY`

### 10. Update Service Worker Configuration (Optional - Only needed for Notifications)

Edit `web/public/firebase-messaging-sw.js` and replace the Firebase config (lines 10-16) with your project's values.

### 11. Deploy Firestore Indexes

**Critical**: The application requires custom Firestore indexes for efficient querying. Follow the complete setup guide in [Firebase Service Account Setup - Firestore Index Deployment](docs/features/firebase-service-account-setup.md#firestore-index-deployment).

## Google Cloud Setup

Firebase projects are also Google Cloud projects. Use the same project for these APIs.

### 1. Enable Required APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services** → **Library**
4. Enable these APIs:
   - **Maps JavaScript API** (for web map display)
   - **Geocoding API** (for address geocoding)

### 2. Create Maps API Key (Web)

1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "API Key"
3. Copy the key
4. Click "Restrict Key":
   - Name: `Maps JavaScript API (Web)`
   - **Application restrictions**: HTTP referrers
   - Add referrer: `http://localhost:3000/*`
   - **API restrictions**: Restrict key
   - Select: Maps JavaScript API
5. Save
6. Use as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `/web/.env.local`

### 3. Create Geocoding API Key (Only for Message Ingestion)

1. Create another API key (or clone the previous one)
2. Click "Restrict Key":
   - Name: `Geocoding API (Server)`
   - **Application restrictions**: None
   - **API restrictions**: Restrict key
   - Select: Geocoding API
3. Save
4. Use as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `/ingest/.env.local`

### 4. Get Gemini AI API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API key"
3. Select your Firebase/GCP project (or create new)
4. Copy key
5. Use as `GOOGLE_AI_API_KEY`

## Environment Configuration

Both `/web` and `/ingest` have `.env.example` files with all required variables and comments explaining their purpose.

**Setup:**

1. Copy `.env.example` to `.env.local` in both directories:

   ```bash
   cp web/.env.example web/.env.local
   cp ingest/.env.example ingest/.env.local
   ```

2. Fill in the values from the setup steps above

3. Set `FIREBASE_DATABASE_ID=oboapp-test` in both files to use the test database

4. Uncomment optional variables only if you need them for your work:
   - `NEXT_PUBLIC_FIREBASE_VAPID_KEY` - Only for push notifications
   - `FIREBASE_SERVICE_ACCOUNT_KEY` - Only for backend/crawlers (not needed for frontend-only)
   - `GOOGLE_AI_API_KEY` / `GOOGLE_AI_MODEL` - Only for message ingestion (not needed for frontend/crawlers)

The `.env.example` files are the single source of truth for configuration requirements.

## Installation

### 1. Install Dependencies

Install dependencies in both directories:

```bash
# Web application
cd web
npm install

# Ingest pipeline
cd ../ingest
npm install
```

### 2. Install Playwright (for crawlers)

```bash
cd ingest
npx playwright install chromium
```

## Validation

### 1. Verify Firestore Indexes

Before running tests or crawlers, ensure all Firestore indexes are enabled:

1. Visit [Firebase Console](https://console.firebase.google.com/) → Firestore → Indexes
2. Confirm all indexes show "Enabled" status (not "Building")

### 2. Run Tests

Verify setup by running tests in both directories:

```bash
# Web tests
cd web
npm run test:run

# Ingest tests
cd ../ingest
npm run test:run
```

### 3. Start Development Server

```bash
cd web
npm run dev
```

Open http://localhost:3000 in your browser. You should see the map interface.

### 4. Test a Crawler (Optional)

Run a crawler in dry-run mode:

```bash
cd ingest
npm run crawl -- --source rayon-oborishte-bg --dry-run
```

This fetches data without writing to Firestore.

## Architecture

## Contributing Guidelines

This document provides information for contributors to the Oborishte Map project.

### Getting Started

Before contributing, please familiarize yourself with the project structure and workflow:

1. Read the main [README.md](README.md) for comprehensive documentation about:

   - System architecture and how components work together
   - Setup and installation instructions
   - Development workflow and best practices
   - API documentation and integration guides

2. Review the codebase structure to understand the project organization

3. Check existing issues and pull requests to avoid duplicate work

### How to Contribute

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the project's coding standards
4. Test your changes thoroughly
5. Submit a pull request with a clear description of your changes

### Code Standards

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Add comments for complex logic
- Update documentation when adding new features

### Questions?

If you have questions or need clarification, please:

- Check the [README.md](README.md) first
- Open an issue for discussion
- Reach out to the maintainers

For a detailed understanding of how the system works, see [README.md](README.md) and especially the Documentation section in it.
