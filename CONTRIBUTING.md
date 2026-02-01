# Contributing to OboApp

Thank you for your interest in contributing!

## Quick Start

**New contributor?** Start with zero-dependency local development:

**[Quick Start with Emulators](docs/setup/quick-start-emulators.md)** (5 minutes, no Firebase/GCP account needed)

**Need production setup?** Setting up with real Firebase/Google Cloud:

**[Production Setup Guide](docs/setup/production-setup.md)**

## Project Structure

Monorepo with two main directories:

- **`/web`** - Next.js application (frontend + API routes)
- **`/ingest`** - Data pipeline (crawlers, AI processing, geocoding)

Each has its own `.env.local` configuration.

## Development Resources

- **[AGENTS.md](AGENTS.md)** - Required code patterns and standards for AI agents and developers
- **[External API Mocks](docs/features/external-api-mocks.md)** - Mock Gemini, Geocoding, Overpass, Cadastre
- **[Geocoding Overview](docs/features/geocoding-overview.md)** - Hybrid geocoding system documentation

## Code Standards

- Follow patterns in [AGENTS.md](AGENTS.md)
- TypeScript strict mode, named exports, no barrel files
- Tailwind theme colors from `web/lib/colors.ts` - never hardcode
- Never use `eslint-disable` comments - fix the issue instead
- Add Vitest tests for new functionality (**at least for the pure functions**)

## Pull Request Process

1. Fork and create feature branch
2. Follow [AGENTS.md](AGENTS.md) patterns
3. Add tests for new functionality
4. Run `npm run test:run` in both `web/` and `ingest/`
5. Submit PR with clear description
