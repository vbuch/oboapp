export interface Message {
  id?: string;
  text: string;
  addresses?: Address[];
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
