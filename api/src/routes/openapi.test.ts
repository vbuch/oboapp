import { describe, expect, it } from "vitest";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { openapiRoute } from "./openapi";

describe("historical incident OpenAPI contract", () => {
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
