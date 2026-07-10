import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppsMock = vi.fn();
const initializeAppMock = vi.fn();
const certMock = vi.fn();
const getFirestoreMock = vi.fn();
const getAuthMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock("firebase-admin/app", () => ({
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
  cert: certMock,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: getFirestoreMock,
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: getAuthMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}));

describe("ingest/lib/firebase-admin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    delete process.env.USE_FIREBASE_EMULATORS;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_DATABASE_ID;

    certMock.mockImplementation((value: unknown) => ({ cert: value }));
    initializeAppMock.mockReturnValue({ id: "new-admin-app" });
    getFirestoreMock.mockReturnValue({
      id: "db",
      settings: vi.fn(),
    });
    getAuthMock.mockReturnValue({ id: "auth" });
  });

  it("initializes using emulators without service account", async () => {
    getAppsMock.mockReturnValue([]);
    process.env.USE_FIREBASE_EMULATORS = "true";
    process.env.FIREBASE_PROJECT_ID = "demo-project";

    const mod = await import("./firebase-admin");
    Reflect.get(mod.adminApp as object, "id");

    expect(mod.adminApp).toBeDefined();
    expect(initializeAppMock).toHaveBeenCalledWith({
      projectId: "demo-project",
    });
    expect(getFirestoreMock).toHaveBeenCalledTimes(1);
    expect(getAuthMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).toHaveBeenCalledWith("Firebase Admin using emulators");
  });

  it("throws on access when service account key is missing in non-emulator mode", async () => {
    getAppsMock.mockReturnValue([]);

    const mod = await import("./firebase-admin");

    expect(() => Reflect.get(mod.adminDb as object, "id")).toThrowError(
      /FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required/,
    );
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it("initializes with service account in non-emulator mode", async () => {
    getAppsMock.mockReturnValue([]);
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: "test@example.com",
      private_key: "test-key",
      project_id: "test-project",
    });
    process.env.FIREBASE_PROJECT_ID = "test-project";

    const mod = await import("./firebase-admin");
    Reflect.get(mod.adminAuth as object, "id");

    expect(mod.adminAuth).toBeDefined();
    expect(certMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(getFirestoreMock).toHaveBeenCalledWith({ id: "new-admin-app" });
    expect(getAuthMock).toHaveBeenCalledWith({ id: "new-admin-app" });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("reuses existing app instead of initializing a new one", async () => {
    getAppsMock.mockReturnValue([{ id: "existing-app" }]);

    const mod = await import("./firebase-admin");
    Reflect.get(mod.adminApp as object, "id");

    expect(mod.adminApp).toBeDefined();
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getFirestoreMock).toHaveBeenCalledWith({ id: "existing-app" });
    expect(getAuthMock).toHaveBeenCalledWith({ id: "existing-app" });
  });
});
