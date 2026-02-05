# OboApp

A civic tech platform that helps residents of Sofia stay informed about infrastructure disruptions. The app automatically aggregates public announcements about water shutoffs, heating maintenance, road repairs, and municipal works, displaying them on an interactive map with push notifications for areas you care about.

## ⚠️ MONOREPO SETUP

**This is an npm workspace monorepo. Always run `npm install` at the repository root.**

The shared package builds automatically via postinstall hook. All workspace dependencies are hoisted to the root.

## Project Structure

This monorepo contains three packages:

- **[shared/](shared)** - Shared TypeScript schemas (Zod) used by both web and ingest
- **[ingest/](ingest)** - Automated data collection and processing pipeline
- **[web/](web)** - Next.js web application

## How It Works

### Ingest Pipeline

Automated crawlers collect notices from public sources (water company, heating provider, municipal sites). AI-powered extraction and multi-service geocoding (Google, OpenStreetMap, Bulgarian Cadastre, GTFS) converts raw text into map-ready GeoJSON. The notification engine matches new disruptions with user-defined interest areas and sends push notifications.

See [ingest/](ingest) for details.

### Web App

Next.js application with an interactive Google Maps interface. Users can browse current disruptions, define interest circles with custom radius, and receive push notifications when new issues affect their areas. Installable as a Progressive Web App.

See [web/](web) for details.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Google Maps API
- **Backend**: Node.js, Firebase (Firestore, Auth, Cloud Messaging)
- **AI**: Google Gemini for address extraction
- **Infrastructure**: Google Cloud Run, Terraform, Docker, Vercel
- **Automation**: Playwright for web scraping

## Documentation

### Features

- [Message Filtering](docs/features/message-filtering.md) - AI-powered content filtering, address extraction, geocoding, and time-based relevance
- [Geocoding System](docs/features/geocoding-overview.md) - Multi-service geocoding with Google, OpenStreetMap, Bulgarian Cadastre, and GTFS APIs
- [Onboarding Flow](docs/features/onboarding-flow.md) - User onboarding state machine for notifications and zone creation
- [Your Sofia API](web/app/api/ysm/README.md) - Public API contract for the Your Sofia mobile client

### Pipeline

- [Ingest Overview](ingest/README.md) - Data collection and processing pipeline architecture
- [Message Processing](ingest/messageIngest/README.md) - Filtering, extraction, geocoding, and GeoJSON conversion flow
- [Crawlers](ingest/crawlers/README.md) - Data sources and web scraping implementations

### Operations

- [Notifications](ingest/notifications/README.md) - Push notification matching and delivery
- [Terraform](ingest/terraform/README.md) - Cloud Run deployment and infrastructure
- [Web App](web/README.md) - PWA installation and browser support

## Style

Documentation is written for technical stakeholders, system administrators, and QA personnel who need to understand system behavior and configuration. Focus is on facts and behavior rather than implementation details, with diagrams for complex flows and practical configuration guidance. We keep it short and informative. We avoid excessive explanations of topics that are standard to the industry or easy to understand.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup instructions, including Firebase and Google Cloud account configuration.
