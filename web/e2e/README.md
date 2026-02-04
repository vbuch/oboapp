# E2E Tests

This directory contains end-to-end tests for the OboApp web application using Playwright and Firebase emulators.

## Prerequisites

1. **Java 21+**: Required for Firebase emulators
   ```bash
   java --version  # Should show version 21 or higher
   ```

2. **Firebase Emulators**: Must be running before tests execute
   ```bash
   cd ../ingest
   npm run emulators
   ```

3. **Playwright Browsers**: Install once
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### Quick Start

The easiest way to run tests is to let Playwright start the dev server automatically:

```bash
# From the web directory
npm run test:e2e
```

This will:
1. Start the Next.js dev server with emulator configuration (`dev:emulator`)
2. Run all E2E tests
3. Generate an HTML report

### Manual Setup (for development)

For better control during test development:

1. **Start Firebase Emulators** (in a separate terminal):
   ```bash
   cd ../ingest
   npm run emulators
   ```

2. **Start the Dev Server** (in another terminal):
   ```bash
   npm run dev:emulator
   ```

3. **Run Tests** (in a third terminal):
   ```bash
   npm run test:e2e
   ```

### Available Test Commands

- `npm run test:e2e` - Run all tests headlessly
- `npm run test:e2e:ui` - Open Playwright UI for interactive testing
- `npm run test:e2e:headed` - Run tests in headed mode (see the browser)
- `npm run test:e2e:debug` - Run tests in debug mode with Playwright Inspector

## Test Scenarios

### Unknown User Landing Page (`landing-page.spec.ts`)

Tests the initial experience for users with no browsing history:

1. **Cookie Consent Toolbar**: Verifies that the cookie consent banner is displayed with "Accept" and "Decline" buttons
2. **Filter Box**: Verifies that the category filter box handle is visible on the map
3. **Login Button**: Verifies that the "Влез" (Login) button appears in the header

## Writing Tests

### Test Structure

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ context }) => {
    // Clear cookies and storage to simulate unknown user
    await context.clearCookies();
  });

  test("should do something", async ({ page }) => {
    await page.goto("/");
    // Test assertions...
  });
});
```

### Best Practices

1. **Clear State**: Always clear cookies/localStorage in `beforeEach` for unknown user tests
2. **Wait for Elements**: Use Playwright's auto-waiting with `expect().toBeVisible()`
3. **Avoid Timeouts**: Prefer `waitForLoadState()` over arbitrary `waitForTimeout()`
4. **Descriptive Selectors**: Use text content or ARIA labels when possible
5. **Firebase Emulators**: Tests assume emulators are running on default ports (auth: 9099, firestore: 8080)

## Troubleshooting

### Tests Fail to Start

- **Check Java Version**: Firebase emulators require Java 21+
  ```bash
  java --version
  ```

- **Verify Emulators Are Running**:
  ```bash
  curl http://localhost:8080  # Should return Firestore emulator response
  curl http://localhost:9099  # Should return Auth emulator response
  ```

### Tests Time Out

- Increase timeout in `playwright.config.ts` if the dev server takes longer to start
- Check that `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` is set in `.env.local`

### Browser Not Found

```bash
npx playwright install chromium
```

## CI/CD

The tests are configured to run in CI with:
- Automatic retries (2 retries per test)
- Sequential execution (workers: 1)
- Screenshots on failure
- HTML report generation

Environment variables in CI should include:
- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`
- `FIRESTORE_EMULATOR_HOST=localhost:8080`
- `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

This opens an interactive report with:
- Test results and timing
- Screenshots of failures
- Traces for debugging
- Network activity logs
