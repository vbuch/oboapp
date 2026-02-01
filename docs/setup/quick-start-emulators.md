# Quick Start with Firebase Emulators

Run oboapp locally with zero cloud dependencies using Firebase Emulators and mock APIs.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+

## Setup (5 minutes)

### 1. Configure Environment

```bash
# Copy environment templates
cp ingest/.env.example.emulator ingest/.env.local
cp web/.env.example.emulator web/.env.local
```

### 2. Install Dependencies

```bash
cd ingest && npm install && cd ..
cd web && npm install && cd ..
```

### 3. Start Emulators

```bash
docker-compose up firebase-emulators
```

Wait for: `✔  All emulators ready! It is now safe to connect your app.`

**Emulator UI:** http://localhost:4000

### 4. Seed Test Data (First Time)

Open new terminal:

```bash
cd ingest
npm run emulator:seed
```

Stop emulators (Ctrl+C), then restart. Data persists across restarts.

### 5. Start Web App

```bash
cd web
npm run dev
```

**App:** http://localhost:3000

## What You Get

- Firestore database with sample messages, sources, interest zones
- Firebase Authentication (Google Sign-In mocked)
- Mock external APIs (Gemini, Google Geocoding, Overpass, Cadastre)
- Emulator UI for data inspection

## Common Operations

**Run crawler (mocked):**

```bash
cd ingest
npm run crawl -- --source rayon-oborishte-bg --dry-run
```

**Run ingestion pipeline (mocked):**

```bash
cd ingest
npm run ingest
```

**Reset data:**

```bash
cd ingest
npm run emulator:clear
npm run emulator:seed
```

## Troubleshooting

**Emulators won't start:** Install firebase-tools globally: `npm install -g firebase-tools`

**Web app can't connect:** Verify `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `web/.env.local`

**Empty Firestore UI:** Navigate to http://localhost:4000/firestore/default/data?ns=demo-project

**Mock APIs not working:** Verify `MOCK_*=true` variables in `ingest/.env.local`

## Known Limitations

- Firebase Cloud Messaging has no emulator
- Firestore indexes are ignored
- All external API calls are mocked

For production setup, see [production-setup.md](production-setup.md).

For mock customization, see [external-api-mocks.md](../features/external-api-mocks.md).
