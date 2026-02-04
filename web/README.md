# Web Application

Next.js web application for **OboApp** - a civic engagement platform for residents of Sofia, Bulgaria. Aggregates and visualizes public announcements about local events, infrastructure work, and service disruptions on an interactive map.

## Tech Stack

- **Next.js 16** with React 19 and TypeScript
- **Firebase** (Authentication, Firestore, Cloud Messaging)
- **Google Maps API** for interactive mapping
- **Turf.js** for geospatial analysis
- **Tailwind CSS v4** with centralized theme system

## Development

### Testing

The project includes both unit tests (Vitest) and end-to-end tests (Playwright):

- **Unit Tests**: `npm test` - Run Vitest unit tests
- **E2E Tests**: `npm run test:e2e` - Run Playwright E2E tests (requires Firebase emulators)

See [e2e/README.md](e2e/README.md) for detailed E2E testing documentation.

## Hosting

Hosted on Vercel.

## Styling

The application uses a centralized Tailwind CSS theme system:
- **Theme colors**: Defined in [lib/colors.ts](lib/colors.ts) as the single source of truth
- **CSS variables**: Implemented in [app/globals.css](app/globals.css) using Tailwind v4 @theme
- **Utilities**: Button styles and helpers available in [lib/theme.ts](lib/theme.ts)

See [AGENTS.md](../AGENTS.md#tailwind-theme-system) for usage guidelines.

## Key Features

- Interactive map displaying geolocated messages from municipal sources
- User-defined interest zones with customizable radius
- Push notifications for new messages in areas of interest
- Progressive Web App with offline support

## Push Notifications

### Browser Support

Push notifications are supported on:
- **Chrome/Edge/Opera** (Desktop & Android) - works in regular browser
- **Firefox** (Desktop & Android) - works in regular browser
- **Safari** (macOS 16.4+) - works in regular browser
- **Safari** (iOS 16.4+) - **requires PWA installation**

### iOS Safari Requirements

**Important:** On iOS Safari, push notifications only work when the app is installed as a PWA (added to Home Screen). This is a platform limitation by Apple.

To enable notifications on iOS Safari:

1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Select "Add to Home Screen"
4. Open the app from your Home Screen
5. Grant notification permission when prompted

The app automatically detects iOS Safari and displays installation instructions when needed.

## Ingestion

Backend data ingestion handled by the [`/ingest`](../ingest) folder.
