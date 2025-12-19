export interface Message {
  id?: string;
  text: string;
  addresses?: Address[];
  extractedData?: ExtractedData;
  geoJson?: GeoJSONFeatureCollection;
  createdAt: Date | string;
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

export interface ExtractedData {
  responsible_entity: string;
  pins: Pin[];
  streets: StreetSection[];
}

// GeoJSON Types
export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
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
}
