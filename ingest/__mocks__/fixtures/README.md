# Mock Fixtures

This directory contains captured API responses used for local development without external API dependencies.

## Directory Structure

- `gemini/` - Google Gemini AI responses (categorization & extraction)
- `google-geocoding/` - Google Geocoding API responses
- `overpass/` - OpenStreetMap Overpass API responses
- `cadastre/` - Bulgarian Cadastre API responses

## Generating Fixtures

Run the capture script with real API keys:

```bash
cd ingest
npm run capture-fixtures
```

This will call the real APIs and save responses to fixture files.

## Custom Fixtures

Create custom fixture files ending in `-custom.json` for specific test scenarios. These are gitignored.

Example:

```bash
cp gemini/categorize-water-disruption.json gemini/my-test-custom.json
# Edit my-test-custom.json
export GEMINI_FIXTURE_PATH=__mocks__/fixtures/gemini/my-test-custom.json
```
