/**
 * API clients collection repository.
 * Stores registered external API clients and their keys.
 */

import type { DbClient, WhereClause } from "../types";

/** Collection name constant */
export const API_CLIENTS_COLLECTION = "apiClients";

export class ApiClientsRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.findOne(API_CLIENTS_COLLECTION, id);
  }

  /** Find the API client registered to a given user (at most one). */
  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const results = await this.db.findMany(API_CLIENTS_COLLECTION, {
      where: [{ field: "userId", op: "==", value: userId }],
      limit: 1,
    });
    return results[0] ?? null;
  }

  /** Look up an API client by its key value (for per-request validation). */
  async findByApiKey(apiKey: string): Promise<Record<string, unknown> | null> {
    const results = await this.db.findMany(API_CLIENTS_COLLECTION, {
      where: [{ field: "apiKey", op: "==", value: apiKey }],
      limit: 1,
    });
    return results[0] ?? null;
  }

  async insertOne(data: Record<string, unknown>): Promise<string> {
    return this.db.insertOne(API_CLIENTS_COLLECTION, data);
  }

  async deleteOne(id: string): Promise<void> {
    return this.db.deleteOne(API_CLIENTS_COLLECTION, id);
  }

  /**
   * Delete all API clients for a user (used in user deletion cascade).
   */
  async deleteByUserId(userId: string): Promise<number> {
    return this.db.deleteMany(API_CLIENTS_COLLECTION, [
      { field: "userId", op: "==", value: userId },
    ]);
  }

  async count(where?: WhereClause[]): Promise<number> {
    return this.db.count(API_CLIENTS_COLLECTION, where);
  }
}
