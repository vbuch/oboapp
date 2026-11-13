import { Hono } from "hono";
import { z } from "../lib/zod-openapi";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import type { HeaderObject, OpenAPIObject } from "openapi3-ts/oas30";
import {
  MessageSchema,
  SourceSchema,
  SourceSnapshotSchema,
} from "../schema/contract";
import {
  SourcesResponseSchema,
  SourceSnapshotResponseSchema,
  SourceTimelineResponseSchema,
  SourceIncidentsResponseSchema,
  MessagesResponseSchema,
  MessageResponseSchema,
  ErrorResponseSchema,
} from "../schema/response";
import { getMaxMessagesLimit } from "../lib/messages-limit-config";

const compareStrings = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
};

const maxMessagesLimit = getMaxMessagesLimit();

const sortRecord = <T>(record: Record<string, T>): Record<string, T> =>
  Object.keys(record)
    .sort(compareStrings)
    .reduce<Record<string, T>>((acc, key) => {
      acc[key] = record[key];
      return acc;
    }, {});

const sortOpenApiDocument = (document: OpenAPIObject): OpenAPIObject => ({
  ...document,
  paths: document.paths ? sortRecord(document.paths) : document.paths,
  components: document.components
    ? {
        ...document.components,
        schemas: document.components.schemas
          ? sortRecord(document.components.schemas)
          : document.components.schemas,
      }
    : document.components,
});

function buildOpenApiSpec(): OpenAPIObject {
  const registry = new OpenAPIRegistry();

  const rateLimitLimitHeader: HeaderObject = {
    description:
      "Configured maximum requests per minute for the API key when PUBLIC_API_RATE_LIMIT_PER_MINUTE is set.",
    schema: { type: "integer", minimum: 0, example: 60 as const },
  };
  const rateLimitRemainingHeader: HeaderObject = {
    description:
      "Remaining requests in the current minute window for the API key when rate limiting is enabled.",
    schema: { type: "integer", minimum: 0, example: 42 as const },
  };
  const retryAfterHeader: HeaderObject = {
    description:
      "Seconds until the next request window. Returned only with 429 responses when rate limiting is enabled.",
    schema: { type: "integer", minimum: 0, example: 12 as const },
  };

  registry.registerComponent("securitySchemes", "ApiKeyAuth", {
    type: "apiKey",
    in: "header",
    name: "X-Api-Key",
    description:
      "API key created and managed in OboApp Settings. Create an API key in Settings and include it in the X-Api-Key header.",
  });

  const errorResponse = registry.register(
    "V1ErrorResponse",
    ErrorResponseSchema,
  );
  registry.register("V1Message", MessageSchema);
  registry.register("V1Source", SourceSchema);
  registry.register("V1SourceSnapshot", SourceSnapshotSchema);
  const sourcesResponse = registry.register(
    "V1SourcesResponse",
    SourcesResponseSchema,
  );
  const sourceSnapshotResponse = registry.register(
    "V1SourceSnapshotResponse",
    SourceSnapshotResponseSchema,
  );
  const sourceTimelineResponse = registry.register("V1SourceTimelineResponse", SourceTimelineResponseSchema);
  const sourceIncidentsResponse = registry.register(
    "V1SourceIncidentsResponse",
    SourceIncidentsResponseSchema,
  );
  const messagesResponse = registry.register(
    "V1MessagesResponse",
    MessagesResponseSchema,
  );
  const messageResponse = registry.register(
    "V1MessageResponse",
    MessageResponseSchema,
  );

  registry.registerPath({
    method: "get",
    path: "/v1/sources",
    description: "List all sources with logo URLs.",
    security: [{ ApiKeyAuth: [] }],
    responses: {
      200: {
        description: "Sources response",
        content: { "application/json": { schema: sourcesResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
        },
      },
      429: {
        description: "Rate limit exceeded (only when rate limiting is enabled)",
        content: { "application/json": { schema: errorResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
          "Retry-After": retryAfterHeader,
        },
      },
      401: {
        description: "Invalid or missing API key",
        content: { "application/json": { schema: errorResponse } },
      },
      500: {
        description: "Server error",
        content: { "application/json": { schema: errorResponse } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/sources/{sourceId}/snapshot",
    description:
      "Fetch the latest successful complete listing count for a configured source. observedAt is the source check time and remains unchanged when a later crawl fails. Snapshot collection is currently supported for toplo-bg and includes accidents and repairs.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({
        sourceId: z.string().min(1),
      }),
    },
    responses: {
      200: {
        description: "Latest successful source snapshot, including a valid zero count",
        content: { "application/json": { schema: sourceSnapshotResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
        },
      },
      401: {
        description: "Invalid or missing API key",
        content: { "application/json": { schema: errorResponse } },
      },
      404: {
        description:
          "Source is not configured for this locality, or no successful snapshot has been recorded",
        content: { "application/json": { schema: errorResponse } },
      },
      429: {
        description: "Rate limit exceeded (only when rate limiting is enabled)",
        content: { "application/json": { schema: errorResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
          "Retry-After": retryAfterHeader,
        },
      },
      500: {
        description: "Server error",
        content: { "application/json": { schema: errorResponse } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/sources/{sourceId}/timeline",
    description: "Current count, daily closing history, and the change from the previous Sofia calendar day. Daily records are collected nightly and retained until explicitly deleted. Missing days are omitted.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({ sourceId: z.string().min(1) }),
      query: z.object({ days: z.coerce.number().int().min(1).max(366).default(90) }),
    },
    responses: {
      200: { description: "Source timeline; unavailable current or comparison values are null", content: { "application/json": { schema: sourceTimelineResponse } } },
      400: { description: "Invalid days query", content: { "application/json": { schema: errorResponse } } },
      401: { description: "Invalid or missing API key", content: { "application/json": { schema: errorResponse } } },
      404: { description: "Source is not configured for this locality", content: { "application/json": { schema: errorResponse } } },
      429: { description: "Rate limit exceeded", content: { "application/json": { schema: errorResponse } }, headers: { "Retry-After": retryAfterHeader } },
      500: { description: "Server error", content: { "application/json": { schema: errorResponse } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/sources/{sourceId}/incidents",
    description: [
      "Complete Toplo listing, including accidents and repairs, with separate first-record baselines.",
      "Without date, returns the latest listing in its recorded order.",
      "With date, returns the last successful complete capture from that Europe/Sofia calendar day, preserving its actual observedAt and all recorded incident fields.",
      "Dated listings are ordered by reportedStart ascending across both types, missing starts last, then Bulgarian name (Intl.Collator with locale bg and default options), then stable id in binary lexicographic order. Consumers can calculate one-based positions from this complete array.",
      "Today's selected capture can change after later successful checks. Daily samples can omit intraday revisions; full observations remain retained until explicitly deleted.",
      "The deployed Sofia instance's earliest retained detailed capture is 2026-11-11T15:55:42.543Z (Sofia date 2026-11-11), verified on 2026-11-13. Other deployments start at their own first successful detailed capture. Imported aggregate daily counts and earlier first-record baselines do not provide detailed captures.",
      "Missing detailed history and legacy count-only captures return a 503 gap without falling back to another day. Verified empty detailed captures return count 0 and incidents [].",
      "Listing presence does not confirm continuous loss of service, and disappearance does not confirm restoration. Missing dates and first observations are null.",
    ].join(" "),
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({ sourceId: z.string().min(1) }),
      query: z.object({
        date: z.iso.date().optional().openapi({
          description:
            "One real Gregorian calendar date in YYYY-MM-DD format, from 0001-01-01 through today's Europe/Sofia date inclusive. Future dates, year 0000, invalid dates and repeated date parameters return 400. Omit for the latest listing.",
          example: "2026-11-12",
        }),
      }),
    },
    responses: {
      200: {
        description:
          "Selected complete incident listing with count and actual observedAt from the same capture, including a verified empty list",
        content: { "application/json": { schema: sourceIncidentsResponse } },
      },
      400: {
        description: "Invalid, out-of-bounds or repeated date query parameter",
        content: { "application/json": { schema: errorResponse } },
      },
      401: {
        description: "Invalid or missing API key",
        content: { "application/json": { schema: errorResponse } },
      },
      404: {
        description: "Incident listing is not configured for this source and locality",
        content: { "application/json": { schema: errorResponse } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: errorResponse } },
        headers: { "Retry-After": retryAfterHeader },
      },
      503: {
        description:
          "Detailed-history gap: no capture exists for the requested day, or the selected capture has only a legacy count. Without date, no complete latest listing is available.",
        content: { "application/json": { schema: errorResponse } },
      },
      500: {
        description: "Server error or invalid stored listing",
        content: { "application/json": { schema: errorResponse } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/messages",
    description:
      "Fetch messages, optionally filtered by bounds and categories.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      query: z.object({
        north: z.string().optional(),
        south: z.string().optional(),
        east: z.string().optional(),
        west: z.string().optional(),
        zoom: z.string().optional(),
        categories: z.string().optional(),
        sources: z.string().optional(),
        timespanEndGte: z.string().optional(),
        limit: z.number().int().min(1).max(maxMessagesLimit).optional(),
      }),
    },
    responses: {
      200: {
        description: "Messages response",
        content: { "application/json": { schema: messagesResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
        },
      },
      429: {
        description: "Rate limit exceeded (only when rate limiting is enabled)",
        content: { "application/json": { schema: errorResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
          "Retry-After": retryAfterHeader,
        },
      },
      400: {
        description: "Invalid query parameters",
        content: { "application/json": { schema: errorResponse } },
      },
      401: {
        description: "Invalid or missing API key",
        content: { "application/json": { schema: errorResponse } },
      },
      500: {
        description: "Server error",
        content: { "application/json": { schema: errorResponse } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/v1/messages/by-id",
    description: "Fetch a single message by its ID.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      query: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Message response",
        content: { "application/json": { schema: messageResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
        },
      },
      429: {
        description: "Rate limit exceeded (only when rate limiting is enabled)",
        content: { "application/json": { schema: errorResponse } },
        headers: {
          "X-RateLimit-Limit": rateLimitLimitHeader,
          "X-RateLimit-Remaining": rateLimitRemainingHeader,
          "Retry-After": retryAfterHeader,
        },
      },
      400: {
        description: "Missing or invalid id parameter",
        content: { "application/json": { schema: errorResponse } },
      },
      401: {
        description: "Invalid or missing API key",
        content: { "application/json": { schema: errorResponse } },
      },
      404: {
        description: "Message not found",
        content: { "application/json": { schema: errorResponse } },
      },
      500: {
        description: "Server error",
        content: { "application/json": { schema: errorResponse } },
      },
    },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);

  const document = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "OboApp Public API",
      version: "1.0.0",
      description:
        "Read-only public API for external consumption of OboApp city-infrastructure data. All data endpoints require a registered API key sent via the X-Api-Key header. You can create and manage API keys from the OboApp Settings page.",
    },
    security: [{ ApiKeyAuth: [] }],
  });

  return sortOpenApiDocument(document);
}

let cachedSpec: OpenAPIObject | null = null;

export const openapiRoute = new Hono();

openapiRoute.get("/openapi", (c) => {
  cachedSpec ??= buildOpenApiSpec();
  return c.json(cachedSpec);
});

openapiRoute.get("/docs", (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>OboApp API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/v1/openapi"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.59"></script>
</body>
</html>`;
  return c.html(html);
});
