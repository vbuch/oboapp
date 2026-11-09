import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { openapiRoute } from "./openapi";

const app = new Hono().route("/v1", openapiRoute);

describe("source snapshot OpenAPI contract", () => {
  it("documents the authenticated snapshot response and error cases", async () => {
    const response = await app.request("/v1/openapi");
    const document = (await response.json()) as OpenAPIObject;

    expect(response.status).toBe(200);
    expect(document.paths?.["/v1/sources/{sourceId}/snapshot"]?.get).toMatchObject({
      security: [{ ApiKeyAuth: [] }],
      parameters: [{ name: "sourceId", in: "path", required: true }],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/V1SourceSnapshotResponse" },
            },
          },
        },
        "401": expect.any(Object),
        "404": expect.any(Object),
        "429": expect.objectContaining({
          headers: expect.objectContaining({ "Retry-After": expect.any(Object) }),
        }),
        "500": expect.any(Object),
      },
    });
    expect(document.components?.schemas?.V1SourceSnapshotResponse).toMatchObject({
      required: ["snapshot"],
      properties: {
        snapshot: document.components?.schemas?.V1SourceSnapshot,
      },
    });
    expect(document.components?.schemas?.V1SourceSnapshot).toMatchObject({
      required: ["sourceType", "locality", "count", "observedAt", "sourceUrl"],
      properties: {
        count: { type: "integer", minimum: 0 },
        observedAt: { type: "string", format: "date-time" },
        sourceUrl: { type: "string", format: "uri" },
      },
    });
  });
});

describe("historical incident OpenAPI contract", () => {
  it("publishes authenticated transition queries and explicit coverage fields", async () => {
    const response = await openapiRoute.request("/openapi");
    const document = await response.json() as OpenAPIObject;
    const operation = document.paths?.["/v1/sources/{sourceId}/incident-changes"]?.get;
    expect(operation).toMatchObject({
      security: [{ ApiKeyAuth: [] }],
      parameters: expect.arrayContaining([
        expect.objectContaining({ name: "date", in: "query", required: false }),
      ]),
      responses: {
        "200": { content: { "application/json": { schema: { $ref: "#/components/schemas/V1SourceIncidentChangesResponse" } } } },
        "400": expect.any(Object),
        "401": expect.any(Object),
        "404": expect.any(Object),
        "429": expect.any(Object),
        "500": expect.any(Object),
      },
    });
    expect(operation?.description).toContain("more than 256 captures");
    expect(operation?.description).toContain("continuity remains unknown");
    expect(document.components?.schemas?.V1SourceIncidentChangesResponse).toMatchObject({
      properties: {
        totals: { nullable: true },
        coverage: { properties: { gaps: { type: "array" }, stale: { nullable: true } } },
      },
    });
  });

  it("documents the optional bounded calendar date and gap response", async () => {
    const response = await openapiRoute.request("/openapi");
    const document = await response.json() as OpenAPIObject;
    const operation = document.paths?.["/v1/sources/{sourceId}/incidents"]?.get;

    expect(response.status).toBe(200);
    expect(operation).toMatchObject({
      security: [{ ApiKeyAuth: [] }],
      parameters: expect.arrayContaining([
        expect.objectContaining({
          name: "sourceId",
          in: "path",
          required: true,
          schema: expect.objectContaining({ type: "string", enum: ["toplo-bg"] }),
          description: expect.stringContaining("Currently only toplo-bg is supported"),
        }),
        expect.objectContaining({
          name: "date",
          in: "query",
          required: false,
          schema: expect.objectContaining({ type: "string", format: "date" }),
          description: expect.stringContaining("0001-01-01"),
        }),
      ]),
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/V1SourceIncidentsResponse" },
            },
          },
        },
        "400": expect.any(Object),
        "401": expect.any(Object),
        "404": expect.any(Object),
        "500": expect.any(Object),
        "503": {
          description: expect.stringContaining("Detailed-history gap"),
        },
      },
    });
    expect(operation?.description).toContain("Complete incident listing for the selected source");
    expect(operation?.description).toContain("currently support only toplo-bg in bg.sofia");
    expect(operation?.description).toContain("reportedStart ascending across both types");
    expect(operation?.description).toContain("actual observedAt");
    expect(operation?.description).toContain("Daily samples can omit intraday revisions");
    expect(operation?.description).toContain("without falling back to another day");
  });
});
