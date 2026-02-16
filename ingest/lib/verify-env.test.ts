import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyEnvSet, verifyDbEnv } from "./verify-env";

describe("verifyEnvSet", () => {
  const KEY = "TEST_VERIFY_ENV_KEY";
  const OTHER = "ANOTHER_MISSING_KEY";

  it("does not throw when keys are present", () => {
    const old = process.env[KEY];
    process.env[KEY] = "1";
    try {
      expect(() => verifyEnvSet([KEY])).not.toThrow();
    } finally {
      if (old === undefined) delete process.env[KEY];
      else process.env[KEY] = old;
    }
  });

  it("throws listing missing keys when absent", () => {
    const old = process.env[KEY];
    delete process.env[KEY];
    try {
      expect(() => verifyEnvSet([KEY, OTHER])).toThrow(
        new RegExp(
          `Missing required environment variables: .*${KEY}.*${OTHER}`,
        ),
      );
    } finally {
      if (old === undefined) delete process.env[KEY];
      else process.env[KEY] = old;
    }
  });
});

describe("verifyDbEnv", () => {
  let savedFirestore: string | undefined;
  let savedMongo: string | undefined;
  let savedUseEmulators: string | undefined;
  let savedFirestoreEmulatorHost: string | undefined;

  beforeEach(() => {
    savedFirestore = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    savedMongo = process.env.MONGODB_URI;
    savedUseEmulators = process.env.USE_FIREBASE_EMULATORS;
    savedFirestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  });

  afterEach(() => {
    if (savedFirestore === undefined)
      delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    else process.env.FIREBASE_SERVICE_ACCOUNT_KEY = savedFirestore;
    if (savedMongo === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = savedMongo;
    if (savedUseEmulators === undefined)
      delete process.env.USE_FIREBASE_EMULATORS;
    else process.env.USE_FIREBASE_EMULATORS = savedUseEmulators;
    if (savedFirestoreEmulatorHost === undefined)
      delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = savedFirestoreEmulatorHost;
  });

  it("passes with only FIREBASE_SERVICE_ACCOUNT_KEY", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = "{}";
    delete process.env.MONGODB_URI;
    delete process.env.USE_FIREBASE_EMULATORS;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    expect(() => verifyDbEnv()).not.toThrow();
  });

  it("passes with only MONGODB_URI", () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    delete process.env.USE_FIREBASE_EMULATORS;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    expect(() => verifyDbEnv()).not.toThrow();
  });

  it("passes with both backends configured", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = "{}";
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    delete process.env.USE_FIREBASE_EMULATORS;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    expect(() => verifyDbEnv()).not.toThrow();
  });

  it("passes with USE_FIREBASE_EMULATORS=true and no service account key", () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.MONGODB_URI;
    process.env.USE_FIREBASE_EMULATORS = "true";
    delete process.env.FIRESTORE_EMULATOR_HOST;
    expect(() => verifyDbEnv()).not.toThrow();
  });

  it("passes with FIRESTORE_EMULATOR_HOST and no service account key", () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.MONGODB_URI;
    delete process.env.USE_FIREBASE_EMULATORS;
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    expect(() => verifyDbEnv()).not.toThrow();
  });

  it("throws when neither backend is configured", () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.MONGODB_URI;
    delete process.env.USE_FIREBASE_EMULATORS;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    expect(() => verifyDbEnv()).toThrow(/No database configured/);
  });
});
