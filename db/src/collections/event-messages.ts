/**
 * Event-messages collection repository.
 *
 * Links messages to events with matching confidence and signal metadata.
 */

import type { DbClient, FindManyOptions, WhereClause } from "../types";

/** Collection name constant */
export const EVENT_MESSAGES_COLLECTION = "eventMessages";

export class EventMessagesRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(EVENT_MESSAGES_COLLECTION, id);
  }

  async findMany(
    options?: FindManyOptions,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(EVENT_MESSAGES_COLLECTION, options);
  }

  async insertOne(
    data: Record<string, unknown>,
    id?: string,
  ): Promise<string> {
    return this.db.insertOne(EVENT_MESSAGES_COLLECTION, data, id);
  }

  async createOne(data: Record<string, unknown>, id: string): Promise<string> {
    return this.db.createOne(EVENT_MESSAGES_COLLECTION, data, id);
  }

  async updateOne(id: string, data: Record<string, unknown>): Promise<void> {
    return this.db.updateOne(EVENT_MESSAGES_COLLECTION, id, data);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(EVENT_MESSAGES_COLLECTION, id);
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(EVENT_MESSAGES_COLLECTION, where);
  }

  /** Find all event-message links for a given event. */
  async findByEventId(eventId: string): Promise<Record<string, unknown>[]> {
    return this.db.findMany(EVENT_MESSAGES_COLLECTION, {
      where: [{ field: "eventId", op: "==", value: eventId }],
      orderBy: [{ field: "createdAt", direction: "desc" }],
    });
  }

  /** Find event-message link(s) for a given message. */
  async findByMessageId(
    messageId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.db.findMany(EVENT_MESSAGES_COLLECTION, {
      where: [{ field: "messageId", op: "==", value: messageId }],
    });
  }
}
