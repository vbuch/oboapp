import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppsMock = vi.fn();
const initializeAppMock = vi.fn();
const getFirestoreMock = vi.fn();
const getAuthMock = vi.fn();
const connectFirestoreEmulatorMock = vi.fn();
const connectAuthEmulatorMock = vi.fn();

vi.mock("firebase/app", () => ({
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: getFirestoreMock,
  connectFirestoreEmulator: connectFirestoreEmulatorMock,
}));

vi.mock("firebase/auth", () => ({
  getAuth: getAuthMock,
  connectAuthEmulator: connectAuthEmulatorMock,
}));

describe("web/lib/firebase", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    initializeAppMock.mockReturnValue({ id: "app-new" });
    getFirestoreMock.mockReturnValue({ id: "db" });
    getAuthMock.mockReturnValue({ id: "auth" });
  });

  it("initializes a new app and connects emulators only once when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "true");
    getAppsMock.mockReturnValue([]);

    const mod = await import("./firebase");

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(mod.app).toEqual({ id: "app-new" });
    expect(connectFirestoreEmulatorMock).toHaveBeenCalledWith(
      { id: "db" },
      "localhost",
      8080,
    );
    expect(connectAuthEmulatorMock).toHaveBeenCalledWith(
      { id: "auth" },
      "http://localhost:9099",
      { disableWarnings: true },
    );
  });

  it("reuses existing app and skips emulator connect calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "true");
    getAppsMock.mockReturnValue([{ id: "app-existing" }]);

    const mod = await import("./firebase");

    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(mod.app).toEqual({ id: "app-existing" });
    expect(connectFirestoreEmulatorMock).not.toHaveBeenCalled();
    expect(connectAuthEmulatorMock).not.toHaveBeenCalled();
  });
});
