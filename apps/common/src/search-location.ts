import type {
  LocationCoordinates,
  LocationData,
  SearchLocationInput,
  SearchLocationSource,
} from './types';

const DEFAULT_RADIUS_MILES = 5;

/** Build API search_location body from UI settings. */
export function buildAgentSearchLocation(
  input: SearchLocationInput | LocationData | undefined,
  propertyAddress?: string
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }

  let source: SearchLocationSource | undefined;
  let radiusMiles = DEFAULT_RADIUS_MILES;
  let coordinates: LocationCoordinates | undefined;

  if ('source' in input && input.source) {
    source = input.source;
    radiusMiles = input.radiusMiles ?? DEFAULT_RADIUS_MILES;
    coordinates = input.coordinates;
  } else {
    const legacy = input as LocationData;
    if (legacy.locationType === 'address' && propertyAddress) {
      source = 'property_address';
      radiusMiles = legacy.locationRadius ?? DEFAULT_RADIUS_MILES;
    } else if (legacy.locationType === 'location' && legacy.locationCoordinates) {
      source = 'device_gps';
      radiusMiles = legacy.locationRadius ?? DEFAULT_RADIUS_MILES;
      coordinates = legacy.locationCoordinates;
    }
  }

  if (!source) {
    return undefined;
  }

  if (source === 'device_gps' && !coordinates) {
    return undefined;
  }

  const body: Record<string, unknown> = {
    source,
    radius_miles: radiusMiles,
  };
  if (coordinates) {
    body.coordinates = coordinates;
  }
  return body;
}

/** Default search settings: property address, 5 mi (no device GPS). */
export function defaultSearchLocationInput(): SearchLocationInput {
  return { source: 'property_address', radiusMiles: DEFAULT_RADIUS_MILES };
}

export function searchLocationLabel(
  input: SearchLocationInput | undefined,
  propertyAddress?: string
): string {
  if (!input) {
    return 'No location';
  }
  const radius = input.radiusMiles ?? DEFAULT_RADIUS_MILES;
  if (input.source === 'device_gps' && input.coordinates) {
    return `Near you (${radius}mi)`;
  }
  if (propertyAddress) {
    return `Near property (${radius}mi)`;
  }
  return `${radius}mi`;
}
