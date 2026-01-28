import { z } from "zod";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { CoordinatesSchema } from "@/lib/schema/coordinates.schema";

extendZodWithOpenApi(z);

const GeoJsonPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

const GeoJsonLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});

const GeoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const GeoJsonGeometrySchema = z.discriminatedUnion("type", [
  GeoJsonPointSchema,
  GeoJsonLineStringSchema,
  GeoJsonPolygonSchema,
]);

const GeoJsonFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: GeoJsonGeometrySchema,
  properties: z.record(z.string(), z.unknown()),
});

const GeoJsonFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(GeoJsonFeatureSchema),
});

const AddressSchema = z.object({
  originalText: z.string(),
  formattedAddress: z.string(),
  coordinates: CoordinatesSchema,
  geoJson: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
});

const TimespanSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const PinSchema = z.object({
  address: z.string(),
  timespans: z.array(TimespanSchema),
});

const StreetSectionSchema = z.object({
  street: z.string(),
  from: z.string(),
  to: z.string(),
  timespans: z.array(TimespanSchema),
});

const ExtractedDataSchema = z.object({
  responsible_entity: z.string(),
  pins: z.array(PinSchema),
  streets: z.array(StreetSectionSchema),
  markdown_text: z.string().optional(),
});

const MessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  addresses: z.array(AddressSchema),
  extractedData: ExtractedDataSchema.optional(),
  geoJson: GeoJsonFeatureCollectionSchema,
  createdAt: z.string(),
  crawledAt: z.string().optional(),
  finalizedAt: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  categories: z.array(z.string()),
  timespanStart: z.string().optional(),
  timespanEnd: z.string().optional(),
});

const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  logoUrl: z.string(),
});

const MessageSnapshotSchema = z.object({
  text: z.string(),
  createdAt: z.string(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
});

const NotificationHistoryItemSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  messageSnapshot: MessageSnapshotSchema,
  notifiedAt: z.string(),
  distance: z.number().optional(),
  interestId: z.string(),
  successfulDevicesCount: z.number(),
});

const NotificationSubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  endpoint: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
});

const NotificationSubscriptionRequestSchema = z.object({
  token: z.string(),
  endpoint: z.string(),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const DeleteSubscriptionResponseSchema = z.object({
  success: z.literal(true),
});

export const ysmSchemas = {
  errorResponse: ErrorResponseSchema,
  sourcesResponse: z.object({ sources: z.array(SourceSchema) }),
  categoriesResponse: z.object({ categories: z.array(z.string()) }),
  messagesResponse: z.object({ messages: z.array(MessageSchema) }),
  notificationHistoryResponse: z.array(NotificationHistoryItemSchema),
  notificationSubscriptionStatusResponse: z.object({
    hasSubscription: z.boolean(),
  }),
  notificationSubscriptionResponse: NotificationSubscriptionSchema,
  notificationSubscriptionRequest: NotificationSubscriptionRequestSchema,
  notificationSubscriptionDeleteResponse: DeleteSubscriptionResponseSchema,
};

export type YsmSourcesResponse = z.infer<typeof ysmSchemas.sourcesResponse>;
export type YsmCategoriesResponse = z.infer<
  typeof ysmSchemas.categoriesResponse
>;
export type YsmMessagesResponse = z.infer<typeof ysmSchemas.messagesResponse>;
export type YsmNotificationHistoryResponse = z.infer<
  typeof ysmSchemas.notificationHistoryResponse
>;
export type YsmNotificationSubscriptionResponse = z.infer<
  typeof ysmSchemas.notificationSubscriptionResponse
>;
export type YsmNotificationSubscriptionStatusResponse = z.infer<
  typeof ysmSchemas.notificationSubscriptionStatusResponse
>;
export type YsmNotificationSubscriptionDeleteResponse = z.infer<
  typeof ysmSchemas.notificationSubscriptionDeleteResponse
>;
export type YsmNotificationSubscriptionRequest = z.infer<
  typeof ysmSchemas.notificationSubscriptionRequest
>;

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

export const buildYsmOpenApi = (): OpenAPIObject => {
  const registry = new OpenAPIRegistry();

  const errorResponse = registry.register(
    "YsmErrorResponse",
    ysmSchemas.errorResponse,
  );
  const sourcesResponse = registry.register(
    "YsmSourcesResponse",
    ysmSchemas.sourcesResponse,
  );
  const categoriesResponse = registry.register(
    "YsmCategoriesResponse",
    ysmSchemas.categoriesResponse,
  );
  const messagesResponse = registry.register(
    "YsmMessagesResponse",
    ysmSchemas.messagesResponse,
  );
  const notificationHistoryResponse = registry.register(
    "YsmNotificationHistoryResponse",
    ysmSchemas.notificationHistoryResponse,
  );
  const notificationSubscriptionStatusResponse = registry.register(
    "YsmNotificationSubscriptionStatusResponse",
    ysmSchemas.notificationSubscriptionStatusResponse,
  );
  const notificationSubscriptionResponse = registry.register(
    "YsmNotificationSubscriptionResponse",
    ysmSchemas.notificationSubscriptionResponse,
  );
  const notificationSubscriptionDeleteResponse = registry.register(
    "YsmNotificationSubscriptionDeleteResponse",
    ysmSchemas.notificationSubscriptionDeleteResponse,
  );

  registry.registerPath({
    method: "get",
    path: "/api/ysm/sources",
    description: "List all sources with logo URLs.",
    responses: {
      200: {
        description: "Sources response",
        content: {
          "application/json": {
            schema: sourcesResponse,
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
    path: "/api/ysm/categories",
    description: "List all available categories (including uncategorized).",
    responses: {
      200: {
        description: "Categories response",
        content: {
          "application/json": {
            schema: categoriesResponse,
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
    path: "/api/ysm/messages",
    description:
      "Fetch messages, optionally filtered by bounds and categories.",
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
    path: "/api/ysm/notifications/history",
    description: "Fetch the latest notification history for the user.",
    responses: {
      200: {
        description: "Notification history response",
        content: {
          "application/json": {
            schema: notificationHistoryResponse,
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
    path: "/api/ysm/notifications/subscription",
    description: "Check if the user has an active subscription.",
    responses: {
      200: {
        description: "Subscription status response",
        content: {
          "application/json": {
            schema: notificationSubscriptionStatusResponse,
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
    method: "post",
    path: "/api/ysm/notifications/subscription",
    description: "Create or update a notification subscription.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: registry.register(
              "YsmNotificationSubscriptionRequest",
              ysmSchemas.notificationSubscriptionRequest,
            ),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Subscription response",
        content: {
          "application/json": {
            schema: notificationSubscriptionResponse,
          },
        },
      },
      400: {
        description: "Validation error",
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
    method: "delete",
    path: "/api/ysm/notifications/subscription",
    description: "Delete a notification subscription by token.",
    request: {
      query: z.object({
        token: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Delete success response",
        content: {
          "application/json": {
            schema: notificationSubscriptionDeleteResponse,
          },
        },
      },
      400: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: errorResponse,
          },
        },
      },
      404: {
        description: "Not found",
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
      title: "YSM API",
      version: "0.0.0",
      description:
        "Public API owned by OboApp and consumed by the Your Sofia mobile client. The contract is pre-production and may change, but client updates are required to follow every API change.",
    },
  });

  return sortOpenApiDocument(document);
};
