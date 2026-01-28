import type { z } from "zod";
import { AddressSchema } from "@shared/schema/address.schema";
import { CoordinatesSchema } from "@shared/schema/coordinates.schema";
import { ExtractedDataSchema } from "@shared/schema/extracted-data.schema";
import {
  GeoJsonFeatureCollectionSchema,
  GeoJsonFeatureSchema,
  GeoJsonGeometrySchema,
  GeoJsonLineStringSchema,
  GeoJsonMultiPointSchema,
  GeoJsonPointSchema,
  GeoJsonPolygonSchema,
} from "@shared/schema/geojson.schema";
import { MessageSnapshotSchema } from "@shared/schema/message-snapshot.schema";
import { NotificationHistoryItemSchema } from "@shared/schema/notification-history.schema";
import { PinSchema } from "@shared/schema/pin.schema";
import { StreetSectionSchema } from "@shared/schema/street-section.schema";
import { TimespanSchema } from "@shared/schema/timespan.schema";

export type IngestErrorType = "warning" | "error" | "exception";

export interface IngestError {
  text: string;
  type: IngestErrorType;
}

export interface Message {
  id?: string;
  text: string;
  markdownText?: string;
  addresses?: Address[];
  extractedData?: ExtractedData;
  geoJson?: GeoJSONFeatureCollection;
  ingestErrors?: IngestError[];
  createdAt: Date | string;
  crawledAt?: Date | string;
  finalizedAt?: Date | string;
  source?: string;
  sourceUrl?: string;
  categories?: string[];
  timespanStart?: Date | string;
  timespanEnd?: Date | string;
}

export type Address = z.infer<typeof AddressSchema>;

export type Timespan = z.infer<typeof TimespanSchema>;

export type Pin = z.infer<typeof PinSchema>;

export type StreetSection = z.infer<typeof StreetSectionSchema>;

export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

// GeoJSON Types
export type GeoJSONGeometry = z.infer<typeof GeoJsonGeometrySchema>;

export type GeoJSONPoint = z.infer<typeof GeoJsonPointSchema>;

export type GeoJSONMultiPoint = z.infer<typeof GeoJsonMultiPointSchema>;

export type GeoJSONLineString = z.infer<typeof GeoJsonLineStringSchema>;

export type GeoJSONPolygon = z.infer<typeof GeoJsonPolygonSchema>;

export type GeoJSONFeature = z.infer<typeof GeoJsonFeatureSchema>;

export type GeoJSONFeatureCollection = z.infer<
  typeof GeoJsonFeatureCollectionSchema
>;

// Intersection coordinates
export type IntersectionCoordinates = z.infer<typeof CoordinatesSchema>;

// User Interest (area of interest on the map)
export interface Interest {
  id?: string;
  userId: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  radius: number; // in meters (min: 100, max: 1000, default: 500)
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Notification Subscription
export interface NotificationSubscription {
  id?: string;
  userId: string;
  token: string; // FCM token
  endpoint: string; // Push subscription endpoint
  createdAt: Date | string;
  updatedAt: Date | string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
  };
}

// Device Notification (tracking individual device send)
export interface DeviceNotification {
  subscriptionId: string; // Reference to notificationSubscription doc
  deviceInfo?: {
    userAgent?: string;
  };
  sentAt: Date | string;
  success: boolean;
  error?: string; // Error message if failed
}

// Message Snapshot (denormalized message data)
export type MessageSnapshot = z.infer<typeof MessageSnapshotSchema>;

// Notification Match (message matched to user's interest)
export interface NotificationMatch {
  id?: string;
  userId: string;
  messageId: string;
  interestId: string;
  matchedAt: Date | string;
  notified: boolean; // Whether notification was sent
  notifiedAt?: Date | string;
  notificationError?: string; // Error if notification failed
  distance?: number; // Distance in meters from interest center to closest point
  deviceNotifications?: DeviceNotification[]; // Array of device-specific sends
  messageSnapshot?: MessageSnapshot; // Denormalized message data
}

// Notification History Item (for API response)
export type NotificationHistoryItem = z.infer<
  typeof NotificationHistoryItemSchema
>;

// Source Configuration
export interface SourceConfig {
  id: string;
  url: string;
  name: string;
}

// Firebase Types
export interface FirebaseNotificationPayload {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
  };
  data?: Record<string, string>;
}
