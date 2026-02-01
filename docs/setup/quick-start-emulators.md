# Quick Start with Firebase Emulators

Get started developing oboapp with **zero cloud dependencies** using Firebase Emulators and mock APIs.

## Prerequisites

- **Docker** and Docker Compose installed
- **Node.js 20+** installed
- **Git** installed

## Quick Start (5 minutes)

### 1. Clone and Setup

```bash
git clone https://github.com/vbuch/oboapp.git
cd oboapp
```

### 2. Configure Environment

```bash
# Copy environment templates
cp ingest/.env.example.emulator ingest/.env.local
cp web/.env.example.emulator web/.env.local
```

Or manually create `ingest/.env.local`:

```dotenv
USE_FIREBASE_EMULATORS=true
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project

MOCK_GEMINI_API=true
MOCK_GOOGLE_GEOCODING=true
MOCK_OVERPASS_API=true
MOCK_CADASTRE_API=true

NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_AI_MODEL=gemini-2.5-flash-lite
```

And `web/.env.local`:

```dotenv
# Backend (API routes) emulator mode
USE_FIREBASE_EMULATORS=true
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project

# Frontend emulator mode
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true

NEXT_PUBLIC_BASE_URL=http://localhost:3000
MESSAGE_RELEVANCE_DAYS=7

# Optional: Google Maps API key (can be empty for basic testing)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

### 3. Install Dependencies

```bash
# Install ingest module dependencies
cd ingest
npm install
cd ..

# Install web module dependencies
cd web
npm install
cd ..
```

### 4. Start Firebase Emulators

```bash
# Start emulators with Docker Compose
docker-compose up firebase-emulators
```

Wait for the output:

```
✔  All emulators ready! It is now safe to connect your app.
```

Access **Emulator UI** at: http://localhost:4000

### 5. Seed Test Data (First Time Only)

Open a new terminal:

```bash
cd ingest
npm run seed:emulator
```

This creates sample messages, sources, interests, and users in the emulator.

**Stop the emulators** (Ctrl+C) to export the seed data, then restart them. The data will persist across restarts.

### 6. Start Web Application

In a new terminal:

```bash
cd web
npm run dev
```

Access the app at: http://localhost:3000

## What You Get

✅ **Full Firestore database** - All CRUD operations work  
✅ **Firebase Authentication** - Google Sign-In simulation  
✅ **Sample data** - 3 messages, 2 interest zones, 1 test user  
✅ **Mock external APIs** - No API costs or rate limits  
✅ **Emulator UI** - Inspect Firestore data, auth users, etc.

## Development Workflow

### Run Crawlers (with mocks)

```bash
cd ingest
npm run crawl -- --source rayon-oborishte-bg --dry-run
```

All API calls use mock fixtures instead of real APIs.

### Run Message Ingestion Pipeline (with mocks)

```bash
cd ingest
npm run ingest
```

Messages are categorized and geocoded using mock data.

### Reset Emulator Data

```bash
# Stop emulators (Ctrl+C)
rm -rf ingest/emulator-data/*_export
npm run emulators
```

Starts with clean slate. Re-run `seed:emulator` to restore test data.

### Emulator Utility Scripts

```bash
npm run check:emulator   # Check current data in emulator
npm run clear:emulator   # Delete all emulator data
npm run seed:emulator    # Populate with test data
```

### Customize Mock Responses

See [External API Mocks](../features/external-api-mocks.md) for details on customizing fixture data.

## Limitations

### What Works

- ✅ Firestore database operations (read/write)
- ✅ Firebase Authentication (Google Sign-In)
- ✅ Message categorization (mocked AI responses)
- ✅ Geocoding (mocked coordinates)
- ✅ UI development and testing

### What Doesn't Work

- ❌ Firebase Cloud Messaging (no emulator exists)
- ❌ Firestore indexes (emulators ignore index requirements)
- ❌ Real external API calls (everything is mocked)
- ❌ Deployment/production testing

For production testing, see [Production Setup Guide](production-setup.md).

## Troubleshooting

### Emulators won't start

**Error:** `firebase: command not found`

**Solution:** Install firebase-tools globally:

```bash
npm install -g firebase-tools
```

### Web app can't connect to emulators

**Error:** `@firebase/firestore: Firestore (10.x.x): Could not reach Cloud Firestore backend`

**Solution:** Verify emulators are running and environment variables are set:

```bash
# In web/.env.local
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

### No data in emulator

**Solution:** Run the seed script:

```bash
cd ingest
npm run seed:emulator
```

### Mock APIs not working

**Solution:** Check environment variables in `ingest/.env.local`:

```dotenv
MOCK_GEMINI_API=true
MOCK_GOOGLE_GEOCODING=true
MOCK_OVERPASS_API=true
MOCK_CADASTRE_API=true
```

## Next Steps

- [External API Mocks Documentation](../features/external-api-mocks.md) - Customize mock responses
- [Production Setup Guide](production-setup.md) - Deploy to real Firebase/GCP
- [Contributing Guide](../../CONTRIBUTING.md) - Code style and PR process
