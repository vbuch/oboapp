import { Address } from './types';

interface GeocodeResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export async function geocodeAddress(address: string): Promise<Address | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const encodedAddress = encodeURIComponent(`${address}, Sofia, Bulgaria`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result: GeocodeResult = data.results[0];
      return {
        originalText: address,
        formattedAddress: result.formatted_address,
        coordinates: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        },
        geoJson: {
          type: 'Point',
          coordinates: [result.geometry.location.lng, result.geometry.location.lat],
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

export async function geocodeAddresses(addresses: string[]): Promise<Address[]> {
  const geocodedAddresses: Address[] = [];

  for (const address of addresses) {
    const geocoded = await geocodeAddress(address);
    if (geocoded) {
      geocodedAddresses.push(geocoded);
    }
    // Add a small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return geocodedAddresses;
}
