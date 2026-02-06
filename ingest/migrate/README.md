# Database Migrations

This folder contains one-time migration scripts for updating existing data in Firestore.

## Naming Convention

Migration scripts follow the pattern: `YYYY-MM-DD-description.ts`

Example: `2024-02-06-add-message-slugs.ts`

## Running Migrations

Migrations are run manually via npm scripts defined in `package.json`:

```bash
npm run migrate:<name>
```

## Creating a New Migration

1. Create a new file following the naming convention
2. Add a clear header comment explaining:
   - What the migration does
   - Why it's needed
   - What data it modifies
3. Make the script idempotent (safe to re-run)
4. Add an npm script in `package.json`
5. Test with emulators before running in production

## Migration Guidelines

- **Idempotent**: Script should skip already-migrated data
- **Batch Processing**: Process in batches of 500 (Firestore limit)
- **Error Handling**: Log errors but continue processing
- **Progress Logging**: Show clear progress indicators
- **Validation**: Check data before and after migration
