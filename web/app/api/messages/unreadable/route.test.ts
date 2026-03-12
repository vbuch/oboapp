import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock data store — tests set this before each test
let mockMessagesData: Record<string, unknown>[] = [];
let lastFindManyOptions: unknown = null;

vi.mock("@/lib/db", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    messages: {
      findMany: vi.fn().mockImplementation(async (options?: any) => {
        lastFindManyOptions = options ?? null;
        let filtered = [...mockMessagesData];

        if (options?.where) {
          for (const clause of options.where) {
            filtered = filtered.filter((doc) => {
              const fieldValue = doc[clause.field];

              switch (clause.op) {
                case ">":
                  if (fieldValue == null) return false;
                  return fieldValue > clause.value;
                case "<":
                  if (fieldValue == null) return false;
                  return fieldValue < clause.value;
                case ">=":
                  if (fieldValue == null) return false;
                  return fieldValue >= clause.value;
                case "<=":
                  if (fieldValue == null) return false;
                  return fieldValue <= clause.value;
                case "==":
                  return fieldValue === clause.value;
                default:
                  return true;
              }
            });
          }
        }

        if (options?.orderBy) {
          filtered.sort((a, b) => {
            for (const { field, direction } of options.orderBy) {
              const aVal = a[field];
              const bVal = b[field];
              let cmp = 0;
              if (aVal instanceof Date && bVal instanceof Date) {
                cmp = aVal.getTime() - bVal.getTime();
              } else if (typeof aVal === "string" && typeof bVal === "string") {
                cmp = aVal.localeCompare(bVal);
              } else if (typeof aVal === "number" && typeof bVal === "number") {
                cmp = aVal - bVal;
              }
              if (cmp !== 0) {
                return direction === "desc" ? -cmp : cmp;
              }
            }
            return 0;
          });
        }

        if (options?.limit) {
          filtered = filtered.slice(0, options.limit);
        }

        return filtered;
      }),
    },
  })),
}));

function makeMessage(
  id: string,
  finalizedAt: Date,
  isUnreadable?: boolean,
): Record<string, unknown> {
  return {
    _id: id,
    text: `Message ${id}`,
    plainText: `Message ${id}`,
    finalizedAt,
    createdAt: finalizedAt,
    source: "test-source",
    sourceUrl: "https://example.com",
    categories: [],
    ...(isUnreadable !== undefined ? { isUnreadable } : {}),
  };
}

describe("GET /api/messages/unreadable - isUnreadable filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesData = [];
    lastFindManyOptions = null;
  });

  it("should only return messages with isUnreadable === true", async () => {
    const now = new Date("2026-01-10T10:00:00.000Z");

    mockMessagesData = [
      makeMessage("msg-unreadable", now, true),
      makeMessage("msg-readable", now, false),
      makeMessage("msg-no-flag", now),
    ];

    const request = new Request("http://localhost/api/messages/unreadable");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg-unreadable");
  });

  it("should return empty list when no unreadable messages exist", async () => {
    const now = new Date("2026-01-10T10:00:00.000Z");

    mockMessagesData = [
      makeMessage("msg-1", now, false),
      makeMessage("msg-2", now),
    ];

    const request = new Request("http://localhost/api/messages/unreadable");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(0);
    expect(data.nextCursor).toBeUndefined();
  });

  it("should return multiple unreadable messages", async () => {
    const date1 = new Date("2026-01-10T12:00:00.000Z");
    const date2 = new Date("2026-01-10T11:00:00.000Z");
    const date3 = new Date("2026-01-10T10:00:00.000Z");

    mockMessagesData = [
      makeMessage("msg-a", date1, true),
      makeMessage("msg-b", date2, false),
      makeMessage("msg-c", date3, true),
    ];

    const request = new Request("http://localhost/api/messages/unreadable");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);
    expect(data.messages.map((m: { id: string }) => m.id)).toEqual([
      "msg-a",
      "msg-c",
    ]);
  });
});

describe("GET /api/messages/unreadable - cursor param validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesData = [];
    lastFindManyOptions = null;
  });

  it("should return 400 when cursorFinalizedAt is provided without cursorId", async () => {
    const request = new Request(
      "http://localhost/api/messages/unreadable?cursorFinalizedAt=2026-01-10T10:00:00.000Z",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain(
      "Both cursorFinalizedAt and cursorId must be provided together",
    );
  });

  it("should return 400 when cursorId is provided without cursorFinalizedAt", async () => {
    const request = new Request(
      "http://localhost/api/messages/unreadable?cursorId=msg-a",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain(
      "Both cursorFinalizedAt and cursorId must be provided together",
    );
  });

  it("should return 400 when cursorFinalizedAt is not a valid date", async () => {
    const request = new Request(
      "http://localhost/api/messages/unreadable?cursorFinalizedAt=not-a-date&cursorId=msg-a",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid cursorFinalizedAt parameter");
  });
});

describe("GET /api/messages/unreadable - pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesData = [];
    lastFindManyOptions = null;
  });

  it("should return nextCursor when more than PAGE_SIZE unreadable messages exist", async () => {
    const start = new Date("2026-01-10T10:00:00.000Z").getTime();

    // Create 14 unreadable messages (PAGE_SIZE = 12, so 2 extra)
    mockMessagesData = Array.from({ length: 14 }, (_, index) => ({
      ...makeMessage(
        `msg-${String(index).padStart(3, "0")}`,
        new Date(start - index * 60_000),
        true,
      ),
    }));

    const request = new Request("http://localhost/api/messages/unreadable");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(12);
    expect(data.nextCursor).toBeDefined();
    expect(data.nextCursor.id).toBe("msg-011");
  });

  it("should not return nextCursor when all messages fit in one page", async () => {
    const now = new Date("2026-01-10T10:00:00.000Z");

    mockMessagesData = Array.from({ length: 5 }, (_, index) =>
      makeMessage(
        `msg-${index}`,
        new Date(now.getTime() - index * 60_000),
        true,
      ),
    );

    const request = new Request("http://localhost/api/messages/unreadable");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(5);
    expect(data.nextCursor).toBeUndefined();
  });

  it("should use cursor to paginate to the next page", async () => {
    const start = new Date("2026-01-10T10:00:00.000Z").getTime();

    mockMessagesData = Array.from({ length: 20 }, (_, index) => ({
      ...makeMessage(
        `msg-${String(index).padStart(3, "0")}`,
        new Date(start - index * 60_000),
        true,
      ),
    }));

    // Fetch first page
    const firstRequest = new Request(
      "http://localhost/api/messages/unreadable",
    );
    const firstResponse = await GET(firstRequest);
    const firstData = await firstResponse.json();

    expect(firstData.messages).toHaveLength(12);
    expect(firstData.nextCursor).toBeDefined();

    // Fetch second page using the cursor
    const { finalizedAt, id } = firstData.nextCursor;
    const secondRequest = new Request(
      `http://localhost/api/messages/unreadable?cursorFinalizedAt=${encodeURIComponent(finalizedAt)}&cursorId=${encodeURIComponent(id)}`,
    );
    const secondResponse = await GET(secondRequest);
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondData.messages).toHaveLength(8);
    expect(secondData.nextCursor).toBeUndefined();

    // No overlap between pages
    const firstIds = firstData.messages.map((m: { id: string }) => m.id);
    const secondIds = secondData.messages.map((m: { id: string }) => m.id);
    const overlap = firstIds.filter((id: string) => secondIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("should use cursorId as tie-breaker for messages with the same finalizedAt", async () => {
    const boundaryDate = new Date("2026-01-10T10:00:00.000Z");
    const olderDate = new Date("2026-01-09T10:00:00.000Z");

    mockMessagesData = [
      { ...makeMessage("msg-c", boundaryDate, true) },
      { ...makeMessage("msg-b", boundaryDate, true) },
      { ...makeMessage("msg-a", boundaryDate, true) },
      { ...makeMessage("msg-older", olderDate, true) },
    ];

    const request = new Request(
      "http://localhost/api/messages/unreadable?cursorFinalizedAt=2026-01-10T10:00:00.000Z&cursorId=msg-b",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages.map((m: { id: string }) => m.id)).toEqual([
      "msg-a",
      "msg-older",
    ]);
  });

  it("should skip records with invalid finalizedAt values", async () => {
    const validDate = new Date("2026-01-10T10:00:00.000Z");

    mockMessagesData = [
      {
        _id: "msg-invalid",
        text: "Invalid",
        plainText: "Invalid",
        finalizedAt: "not-a-date",
        createdAt: validDate,
        source: "test-source",
        categories: [],
        isUnreadable: true,
      },
      makeMessage("msg-valid", validDate, true),
    ];

    const request = new Request("http://localhost/api/messages/unreadable");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg-valid");
  });

  it("should apply a DB-side read limit", async () => {
    const now = new Date();

    mockMessagesData = [makeMessage("msg-1", now, true)];

    const request = new Request("http://localhost/api/messages/unreadable");
    await GET(request);

    expect(lastFindManyOptions).toMatchObject({
      limit: 500,
      orderBy: [{ field: "finalizedAt", direction: "desc" }],
    });
  });
});
