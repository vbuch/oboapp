import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../types";
import { NotificationMatchesRepository } from "./notification-matches";

describe("notification report pagination", () => {
  it("filters processed records and advances by ID with bounded projected pages", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new NotificationMatchesRepository({
      findMany,
    } as unknown as DbClient);
    await repository.findNotifiedPage(500);
    await repository.findNotifiedPage(500, "last-id");
    expect(findMany.mock.calls[0][1]).toMatchObject({
      where: [{ field: "notified", op: "==", value: true }],
      orderBy: [{ field: "_id", direction: "asc" }],
      limit: 500,
    });
    expect(findMany.mock.calls[1][1].where).toContainEqual({
      field: "_id",
      op: ">",
      value: "last-id",
    });
    expect(findMany.mock.calls[1][1].select).toContain("deviceNotifications");
  });
});
