# External API Mocks

Mock external APIs (Gemini, Google Geocoding, Overpass, Cadastre) to avoid costs and network dependencies during development.

## Quick Start

Enable mocks in `ingest/.env.local`:

```dotenv
MOCK_GEMINI_API=true
MOCK_GOOGLE_GEOCODING=true
MOCK_OVERPASS_API=true
MOCK_CADASTRE_API=true
```

When enabled, console shows: `[MOCK] Using Gemini mock for categorization`

## How It Works

Mock services return pre-recorded JSON fixtures from `ingest/__mocks__/fixtures/`:

```
__mocks__/fixtures/
  gemini/
    categorize-construction.json
    extract-pins-streets.json
  google-geocoding/   # Returns Sofia center by default
  overpass/           # Returns empty arrays by default
  cadastre/           # Returns empty arrays by default
```

**Pattern matching** selects fixtures based on input text (see mock service files for logic).

## Generating Fixtures

Capture real API responses to create fixtures:

```bash
# Disable mocks, add real API keys to .env.local
MOCK_GEMINI_API=false
GOOGLE_AI_API_KEY=your_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key

# Run capture
npm run capture-fixtures
```

Or capture from existing Firestore messages:

```bash
npm run capture:firestore
```

## Customizing Fixtures

**Override with custom file:**

```dotenv
GEMINI_FIXTURE_PATH=__mocks__/fixtures/gemini/my-test.json
```

**Edit existing fixtures:**

```bash
nano ingest/__mocks__/fixtures/gemini/categorize-construction.json
```

**Add pattern matching rules** - Edit mock service files in `ingest/__mocks__/services/`

## Limitations

Mocks don't simulate network errors, rate limits, or non-deterministic AI responses. Use real APIs for realistic testing.

## Related

- [Quick Start with Emulators](../setup/quick-start-emulators.md)
- [Production Setup](../setup/production-setup.md)
