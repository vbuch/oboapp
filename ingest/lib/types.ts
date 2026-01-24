import { CategorizedMessage } from "./categorize.schema";
import type { Timestamp } from "firebase-admin/firestore";

export interface Message {
  id?: string;
  text: string;
  addresses?: Address[];
  extractedData?: ExtractedData;
  geoJson?: GeoJSONFeatureCollection;
  ingestErrors?: IngestError[];
  createdAt: Date | string;
  crawledAt?: Date | string;
  finalizedAt?: Date | string;
  source?: string;
  sourceUrl?: string;
  sourceDocumentId?: string;
  markdownText?: string;
  categorize?: CategorizedMessage;
  // Root-level fields flattened from categorize for Firestore indexes
  categories?: string[];
  relations?: string[];
  isRelevant?: boolean;
  // Timespan denormalization for server-side filtering
  timespanStart?: Date | string;
  timespanEnd?: Date | string;
}

export type IngestErrorType = "warning" | "error" | "exception";

export interface IngestError {
  text: string;
  type: IngestErrorType;
}

export interface Address {
  originalText: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  geoJson?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface Timespan {
  start: string;
  end: string;
}

export interface Pin {
  address: string;
  timespans: Timespan[];
}

export interface StreetSection {
  street: string;
  from: string;
  to: string;
  timespans: Timespan[];
}

export interface CadastralProperty {
  identifier: string;
  timespans: Timespan[];
}

export interface ExtractedData {
  responsible_entity: string;
  pins: Pin[];
  streets: StreetSection[];
  cadastralProperties?: CadastralProperty[];
  markdown_text?: string;
}

// GeoJSON Types
export type GeoJSONGeometry =
  | GeoJSONPoint
  | GeoJSONMultiPoint
  | GeoJSONLineString
  | GeoJSONPolygon;

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONMultiPoint {
  type: "MultiPoint";
  coordinates: [number, number][]; // array of [longitude, latitude]
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][]; // array of [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number, number][][]; // array of rings, each ring is array of [longitude, latitude]
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// Intersection coordinates
export interface IntersectionCoordinates {
  lat: number;
  lng: number;
}

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
export interface MessageSnapshot {
  text: string;
  source?: string;
  sourceUrl?: string;
  createdAt: string;
}

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

// Source Configuration
export interface SourceConfig {
  id: string;
  url: string;
  name: string;
}

// Firebase Types
export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
  toDate(): Date;
}

export type FirestoreValue = FirestoreTimestamp | Timestamp | string | Date;

export interface FirebaseNotificationPayload {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
  };
  data?: Record<string, string>;
}

// Overpass API Types
export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  geometry?: OverpassGeometry[];
  tags?: Record<string, string>;
}

export interface OverpassGeometry {
  lat: number;
  lon: number;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

export interface SnapPoint {
  lat: number;
  lng: number;
  distance: number;
}

// AI Service Types
export interface RawPin {
  address: string;
  timespans: RawTimespan[];
}

export interface RawStreet {
  street: string;
  from: string;
  to: string;
  timespans: RawTimespan[];
}

export interface RawCadastralProperty {
  identifier: string;
  timespans: RawTimespan[];
}

export interface RawTimespan {
  start: string;
  end: string;
}

export interface RawExtractedData {
  responsible_entity: string;
  pins?: RawPin[];
  streets?: RawStreet[];
  cadastralProperties?: RawCadastralProperty[];
  markdown_text?: string;
}

// Message Processing Types
export interface MessageProcessingOptions {
  categorizedMessage?: CategorizedMessage;
}

export interface CadastralGeometryCollection {
  features: Array<{
    geometry: GeoJSONGeometry;
    properties: Record<string, unknown>;
  }>;
}

export interface IngestOptions {
  boundariesPath?: string;
  dryRun?: boolean;
  sourceType?: string;
  sourceName?: string;
  limit?: number;
  since?: Date;
  until?: Date;
}

export interface FirestoreDocumentData {
  text: string;
  sourceUrl?: string;
  sourceDocumentId?: string;
  createdAt: Date;
  [key: string]: unknown;
}

// Cadastre Service Types
export interface CadastreProperty {
  identifier: string;
  geometry?: GeoJSONGeometry;
  [key: string]: unknown;
}
