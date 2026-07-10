import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirestoreAdapter } from "./firestore-adapter";

const arrayUnionMock = vi.fn((...values: unknown[]) => ({ __op: "union", values }));
const arrayRemoveMock = vi.fn((...values: unknown[]) => ({ __op: "remove", values }));
const incrementMock = vi.fn((value: number) => ({ __op: "inc", value }));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: arrayUnionMock,
    arrayRemove: arrayRemoveMock,
    increment: incrementMock,
  },
}));

describe("FirestoreAdapter", () => {
  const updateMock = vi.fn();
  const docMock = vi.fn(() => ({ update: updateMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  const firestoreMock = {
    collection: collectionMock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses FieldValue operators for update operator payloads", async () => {
    const adapter = new FirestoreAdapter(firestoreMock as any);

    await adapter.updateOne("messages", "m-1", {
      $set: { title: "Hello" },
      $addToSet: { tags: ["a", "b"], status: "active" },
      $pull: { removed: [1, 2] },
      $inc: { retries: 2 },
    });

    expect(arrayUnionMock).toHaveBeenCalledWith("a", "b");
    expect(arrayUnionMock).toHaveBeenCalledWith("active");
    expect(arrayRemoveMock).toHaveBeenCalledWith(1, 2);
    expect(incrementMock).toHaveBeenCalledWith(2);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Hello",
        tags: { __op: "union", values: ["a", "b"] },
        status: { __op: "union", values: ["active"] },
        removed: { __op: "remove", values: [1, 2] },
        retries: { __op: "inc", value: 2 },
      }),
    );
  });

  it("uses direct transformed update for plain object payloads", async () => {
    const adapter = new FirestoreAdapter(firestoreMock as any);

    await adapter.updateOne("messages", "m-1", {
      title: "Plain",
    });

    expect(updateMock).toHaveBeenCalledWith({ title: "Plain" });
    expect(arrayUnionMock).not.toHaveBeenCalled();
    expect(arrayRemoveMock).not.toHaveBeenCalled();
    expect(incrementMock).not.toHaveBeenCalled();
  });
});
