---
name: firebase-integration
description: Firebase Admin SDK initialization patterns for Node.js scripts. Use when working with Firebase Admin, environment variables, or creating scripts that access Firestore. CRITICAL - dotenv must load before Firebase Admin initializes.
---

# Firebase Integration

## Context

Firebase Admin SDK requires environment variables (particularly `FIREBASE_SERVICE_ACCOUNT_KEY`) to be loaded before initialization. Static imports execute immediately at module load time, before `dotenv.config()` can run, causing "FIREBASE_SERVICE_ACCOUNT_KEY not found" errors.

**Solution**: Always use dynamic imports for Firebase Admin inside your main function.

## Pattern

**CRITICAL: `dotenv` must load _before_ Firebase Admin initializes.**

### Correct Initialization Pattern

```typescript
import dotenv from "dotenv";
import { resolve } from "node:path";

// Load environment variables FIRST
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  // Dynamic import AFTER dotenv.config()
  const { adminDb } = await import("@/lib/firebase-admin");

  // Now safe to use Firebase Admin
  const snapshot = await adminDb.collection("messages").get();
  console.log(`Found ${snapshot.size} messages`);
}

main().catch(console.error);
```

## Guidelines

### 1. Script Structure

Every script using Firebase Admin must follow this pattern:

```typescript
#!/usr/bin/env tsx

import dotenv from "dotenv";
import { resolve } from "node:path";

// ⚠️ CRITICAL: dotenv.config() must be at the top level
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  // ✅ Dynamic import inside function
  const { adminDb, adminAuth } = await import("@/lib/firebase-admin");

  // Your script logic here
  const users = await adminAuth.listUsers();
  console.log(`Found ${users.users.length} users`);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
```

### 2. Environment File Location

Always use `.env.local` for local development:

```typescript
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
```

### 3. Required Environment Variables

Your `.env.local` must include:

```bash
# Firebase Admin SDK service account (required)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Or for production/staging
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=<base64-encoded-key>
```

### 4. Running Scripts

Use npm script wrapper to ensure proper TypeScript execution:

```bash
npm run tsx tmp/my-script.ts
```

Or directly with tsx:

```bash
npx tsx tmp/my-script.ts
```

## Examples

### ✅ Good - Dynamic Import Pattern

```typescript
#!/usr/bin/env tsx

import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  // Dynamic import - Firebase Admin loads AFTER dotenv
  const { adminDb } = await import("@/lib/firebase-admin");

  const messagesRef = adminDb.collection("messages");
  const snapshot = await messagesRef
    .where("finalizedAt", "==", null)
    .get();

  console.log(`Found ${snapshot.size} unfinal messages`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`- ${doc.id}: ${data.text?.substring(0, 50)}...`);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
```

### ✅ Good - Multiple Firebase Services

```typescript
#!/usr/bin/env tsx

import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  // Import all needed Firebase services
  const {
    adminDb,
    adminAuth,
    adminMessaging
  } = await import("@/lib/firebase-admin");

  // Use multiple services
  const user = await adminAuth.getUserByEmail("user@example.com");
  await adminMessaging.send({
    token: user.customClaims?.fcmToken,
    notification: { title: "Test", body: "Message" }
  });

  await adminDb.collection("logs").add({
    action: "notification_sent",
    userId: user.uid,
    timestamp: new Date()
  });
}

main().catch(console.error);
```

### ❌ Bad - Static Import (Will Fail)

```typescript
#!/usr/bin/env tsx

import dotenv from "dotenv";
import { resolve } from "node:path";
// ❌ BAD: Static import executes before dotenv.config()
import { adminDb } from "@/lib/firebase-admin";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  // This will fail with "FIREBASE_SERVICE_ACCOUNT_KEY not found"
  const snapshot = await adminDb.collection("messages").get();
}

main().catch(console.error);
```

### ❌ Bad - dotenv.config() Inside Function

```typescript
#!/usr/bin/env tsx

import { adminDb } from "@/lib/firebase-admin"; // ❌ Too late

async function main() {
  // ❌ BAD: dotenv loads after static import already executed
  const dotenv = await import("dotenv");
  dotenv.config();

  const snapshot = await adminDb.collection("messages").get();
}

main().catch(console.error);
```

## Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT_KEY not found"

**Cause**: Static import of Firebase Admin before dotenv.config()

**Solution**:
1. Remove static import: `import { adminDb } from "@/lib/firebase-admin"`
2. Add dynamic import inside main(): `const { adminDb } = await import("@/lib/firebase-admin")`
3. Ensure dotenv.config() is at top level, before main()

### Error: "Cannot find module '@/lib/firebase-admin'"

**Cause**: Path alias not configured for tsx

**Solution**: Use npm script wrapper:
```bash
npm run tsx tmp/script.ts
```

### Error: Permission denied when executing script

**Cause**: Missing executable permission or incorrect shebang

**Solution**:
```bash
chmod +x tmp/script.ts
# Or run via npx
npx tsx tmp/script.ts
```

## File Locations

### Firebase Configuration Files

- **Web Firebase**: [web/lib/firebase.ts](../../web/lib/firebase.ts) - Client SDK
- **Admin SDK**: [web/lib/firebase-admin.ts](../../web/lib/firebase-admin.ts) - Server-side
- **Ingest Admin**: [ingest/lib/firebase-admin.ts](../../ingest/lib/firebase-admin.ts) - Pipeline scripts

### Environment Files

- **Local development**: `.env.local` (gitignored)
- **Production**: Environment variables set in Cloud Run / deployment platform
- **Example**: `.env.old` (reference only, not used)

## References

- **Firebase Admin SDK Docs**: https://firebase.google.com/docs/admin/setup
- **Service Account Setup**: [docs/features/firebase-service-account-setup.md](../../docs/features/firebase-service-account-setup.md)
- **Related Skills**:
  - `.claude/skills/dry-enforcement` - For extracting Firebase utilities
  - `.claude/skills/message-pipeline` - Uses Firebase Admin extensively
