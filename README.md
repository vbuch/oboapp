# OboApp (oborishte-map)

A civic tech platform that helps residents of Sofia stay informed about infrastructure disruptions. The app automatically aggregates public announcements about water shutoffs, heating maintenance, road repairs, and municipal works, displaying them on an interactive map with push notifications for areas you care about.

## Project Structure

This monorepo contains two main components:

- **[ingest/](ingest)** - Automated data collection and processing pipeline
- **[web/](web)** - Next.js web application

## How It Works

### Ingest Pipeline

Automated crawlers collect notices from public sources (water company, heating provider, municipal sites). AI-powered extraction and geocoding converts raw text into map-ready GeoJSON. The notification engine matches new disruptions with user-defined interest areas and sends push notifications.

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
