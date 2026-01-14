# Agent Development Guidelines

This document provides high-level guidelines for AI agents working on the oboapp codebase. Detailed technical patterns are available in [.claude/skills/](./.claude/skills/) and are automatically loaded when relevant to your current task.

## 1. Core Principles & Workflow

### DRY & Shared Utilities

**Strictly enforce DRY (Don't Repeat Yourself).**

- **Check before implementing:** Always search `web/lib/` and `ingest/lib/` for existing utilities.
- **Extract duplicates:** If code is used in ≥2 files, extract it to shared utilities.

### Developer Preference Enforcement

If you identify a recurring pattern or developer preference:

1. **Apply immediate fix.**
2. **Suggest automation** (ESLint, Prettier, etc.).
3. **Propose AGENTS.md or skill update** if it's a general project standard.

### Required Implementation Steps

**Every implementation plan must end with:**

1. **DRY Extraction:** Identify and extract duplicate patterns.
2. **Unit Tests:** Write Vitest tests for all functional units.
3. **Validation:** Run `npm run test:run` and fix failures.
4. **Documentation:** Update relevant docs as needed.

---

## 2. Project Context

### Tech Stack

- **TypeScript**: Strict mode, no implicit `any`
- **Web**: Next.js, React, Tailwind CSS, Google Maps, Firebase
- **Ingest**: Node.js scripts, LLM processing (filtering + extraction), geocoding services
- **Infrastructure**: Firebase (Firestore, Admin SDK), Cloud Run, Terraform

### Key Concepts

- **Message Pipeline**: Two-stage LLM processing (filter → extract) → geocode → finalize
- **Geocoding**: Hybrid approach (Google for addresses, Overpass for streets, Cadastre for УПИ)
- **GeoJSON**: Always `[longitude, latitude]` order, validate with `validateAndFixGeoJSON`
- **Theme System**: Centralized colors in `lib/colors.ts`, never hardcode colors
- **DRY**: Check `web/lib/` and `ingest/lib/` before implementing utilities

### Web Components

- **Composition:** Break large components into smaller, focused files
- **Location:** Colocate with page if specific; move to `web/components/` if shared
- **Props:** Use `readonly` interfaces
