import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppsMock = vi.fn();
const initializeAppMock = vi.fn();
const getFirestoreMock = vi.fn();
const getAuthMock = vi.fn();

vi.mock("firebase/app", () => ({
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: getFirestoreMock,
}));

vi.mock("firebase/auth", () => ({
  getAuth: getAuthMock,
}));

describe("ingest/lib/firebase", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    initializeAppMock.mockReturnValue({ id: "new-app" });
    getFirestoreMock.mockReturnValue({ id: "db" });
    getAuthMock.mockReturnValue({ id: "auth" });
  });

  it("initializes app when no apps exist", async () => {
    getAppsMock.mockReturnValue([]);

    const mod = await import("./firebase");

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(getFirestoreMock).toHaveBeenCalledWith({ id: "new-app" });
    expect(getAuthMock).toHaveBeenCalledWith({ id: "new-app" });
    expect(mod.app).toEqual({ id: "new-app" });
  });

  it("reuses existing app when available", async () => {
    getAppsMock.mockReturnValue([{ id: "existing-app" }]);

    const mod = await import("./firebase");

    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getFirestoreMock).toHaveBeenCalledWith({ id: "existing-app" });
    expect(getAuthMock).toHaveBeenCalledWith({ id: "existing-app" });
    expect(mod.app).toEqual({ id: "existing-app" });
  });
});
