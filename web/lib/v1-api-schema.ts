// Import zod-openapi first to ensure z is extended before importing shared schemas
import { z } from "@/lib/zod-openapi";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { MessageSchema, SourceSchema } from "@oboapp/shared";

const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const v1Schemas = {
  errorResponse: ErrorResponseSchema,
  message: MessageSchema,
  sourcesResponse: z.object({ sources: z.array(SourceSchema) }),
  messagesResponse: z.object({ messages: z.array(MessageSchema) }),
};

const sortRecord = <T>(record: Record<string, T>): Record<string, T> =>
  Object.keys(record)
    .sort()
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

export const buildV1OpenApi = (): OpenAPIObject => {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "ApiKeyAuth", {
    type: "apiKey",
    in: "header",
    name: "X-Api-Key",
    description:
      "API key issued to registered clients. Contact the OboApp team to register.",
  });

  const errorResponse = registry.register(
    "V1ErrorResponse",
    v1Schemas.errorResponse,
  );
  const message = registry.register("V1Message", v1Schemas.message);
  const sourcesResponse = registry.register(
    "V1SourcesResponse",
    v1Schemas.sourcesResponse,
  );
  const messagesResponse = registry.register(
    "V1MessagesResponse",
    v1Schemas.messagesResponse,
  );

  registry.registerPath({
    method: "get",
    path: "/api/v1/sources",
    description: "List all sources with logo URLs.",
    security: [{ ApiKeyAuth: [] }],
    responses: {
      200: {
        description: "Sources response",
        content: {
          "application/json": {
            schema: sourcesResponse,
          },
        },
      },
      401: {
        description: "Invalid or missing API key",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/messages",
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
      }),
    },
    responses: {
      200: {
        description: "Messages response",
        content: {
          "application/json": {
            schema: messagesResponse,
          },
        },
      },
      400: {
        description: "Invalid query parameters",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
      401: {
        description: "Invalid or missing API key",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/messages/by-id",
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
        content: {
          "application/json": {
            schema: message,
          },
        },
      },
      400: {
        description: "Missing or invalid id parameter",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
      401: {
        description: "Invalid or missing API key",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
      404: {
        description: "Message not found",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
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
        "Read-only public API for external consumption of OboApp city-infrastructure data. All endpoints require a registered API key sent via the X-Api-Key header. Contact the OboApp team to register as a client.",
    },
    security: [{ ApiKeyAuth: [] }],
  });

  return sortOpenApiDocument(document);
};
