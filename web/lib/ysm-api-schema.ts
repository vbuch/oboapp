// Import zod-openapi first to ensure z is extended before importing shared schemas
import { z } from "@/lib/zod-openapi";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { MessageSchema } from "@oboapp/shared";
import { NotificationHistoryItemSchema } from "@oboapp/shared";
import {
  DeleteSubscriptionResponseSchema,
  NotificationSubscriptionRequestSchema,
  NotificationSubscriptionSchema,
  NotificationSubscriptionStatusSchema,
} from "@oboapp/shared";
import { SourceSchema } from "@oboapp/shared";

const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const ysmSchemas = {
  errorResponse: ErrorResponseSchema,
  message: MessageSchema,
  sourcesResponse: z.object({ sources: z.array(SourceSchema) }),
  messagesResponse: z.object({ messages: z.array(MessageSchema) }),
  notificationHistoryResponse: z.object({
    items: z.array(NotificationHistoryItemSchema),
    hasMore: z.boolean(),
    nextOffset: z.number().nullable(),
  }),
  notificationSubscriptionStatusResponse: NotificationSubscriptionStatusSchema,
  notificationSubscriptionResponse: NotificationSubscriptionSchema,
  notificationSubscriptionRequest: NotificationSubscriptionRequestSchema,
  notificationSubscriptionDeleteResponse: DeleteSubscriptionResponseSchema,
};

export type YsmMessage = z.infer<typeof MessageSchema>;
export type YsmSourcesResponse = z.infer<typeof ysmSchemas.sourcesResponse>;
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
  registry.register("YsmMessage", ysmSchemas.message);
  const sourcesResponse = registry.register(
    "YsmSourcesResponse",
    ysmSchemas.sourcesResponse,
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
