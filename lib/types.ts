export interface Message {
  id?: string;
  text: string;
  addresses?: Address[];
  extractedData?: ExtractedData;
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
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface StreetSection {
  street: string;
  from: string;
  to: string;
}

export interface Timespan {
  start: string;
  end: string;
}

export interface ExtractedData {
  responsible_entity: string;
  pins: string[];
  streets: StreetSection[];
  timespan: Timespan[];
}
