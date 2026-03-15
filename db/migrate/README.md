# Migration Scripts

Re-runnable (idempotent) migration scripts. Run from the `db/` directory:

```bash
cd db
npx tsx migrate/<script-name>.ts
```

Each script must contain detailed description on purpose and usage.

The date in the filename only serves as a way to sort them. Each one of them should be runnable without negative side effects at any point in time.
