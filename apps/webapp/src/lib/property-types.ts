// Property types and sub-types constants
// This is a copy from apps/common/src/constants/property-types.ts
// to avoid Next.js module resolution issues with cross-package imports

export type PropertyType = 'home' | 'car' | 'rv' | 'hotel' | 'appliance' | 'other';

export type PropertySubType = 
  // Home sub-types
  | 'single-family' | 'condo' | 'townhouse' | 'apartment' | 'duplex' | 'mobile-home' | 'other-home'
  // Car sub-types
  | 'sedan' | 'suv' | 'truck' | 'coupe' | 'convertible' | 'hatchback' | 'wagon' | 'other-car'
  // RV sub-types
  | 'motorhome' | 'travel-trailer' | 'fifth-wheel' | 'pop-up' | 'toy-hauler' | 'other-rv'
  // Hotel sub-types
  | 'boutique' | 'resort' | 'business' | 'extended-stay' | 'budget' | 'luxury' | 'other-hotel'
  // Appliance sub-types
  | 'refrigerator' | 'washer' | 'dryer' | 'dishwasher' | 'oven' | 'microwave' | 'air-conditioner' | 'heater' | 'water-heater' | 'other-appliance'
  | 'none'; // For when sub-type is not selected

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'car', label: 'Car' },
  { value: 'rv', label: 'RV' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'other', label: 'Other' },
];

export const PROPERTY_SUB_TYPES: Record<PropertyType, { value: PropertySubType; label: string }[]> = {
  home: [
    { value: 'single-family', label: 'Single Family' },
    { value: 'condo', label: 'Condo' },
    { value: 'townhouse', label: 'Townhouse' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'duplex', label: 'Duplex' },
    { value: 'mobile-home', label: 'Mobile Home' },
    { value: 'other-home', label: 'Other' },
  ],
  car: [
    { value: 'sedan', label: 'Sedan' },
    { value: 'suv', label: 'SUV' },
    { value: 'truck', label: 'Truck' },
    { value: 'coupe', label: 'Coupe' },
    { value: 'convertible', label: 'Convertible' },
    { value: 'hatchback', label: 'Hatchback' },
    { value: 'wagon', label: 'Wagon' },
    { value: 'other-car', label: 'Other' },
  ],
  rv: [
    { value: 'motorhome', label: 'Motorhome' },
    { value: 'travel-trailer', label: 'Travel Trailer' },
    { value: 'fifth-wheel', label: 'Fifth Wheel' },
    { value: 'pop-up', label: 'Pop-up' },
    { value: 'toy-hauler', label: 'Toy Hauler' },
    { value: 'other-rv', label: 'Other' },
  ],
  hotel: [
    { value: 'boutique', label: 'Boutique' },
    { value: 'resort', label: 'Resort' },
    { value: 'business', label: 'Business' },
    { value: 'extended-stay', label: 'Extended Stay' },
    { value: 'budget', label: 'Budget' },
    { value: 'luxury', label: 'Luxury' },
    { value: 'other-hotel', label: 'Other' },
  ],
  appliance: [
    { value: 'refrigerator', label: 'Refrigerator' },
    { value: 'washer', label: 'Washer' },
    { value: 'dryer', label: 'Dryer' },
    { value: 'dishwasher', label: 'Dishwasher' },
    { value: 'oven', label: 'Oven' },
    { value: 'microwave', label: 'Microwave' },
    { value: 'air-conditioner', label: 'Air Conditioner' },
    { value: 'heater', label: 'Heater' },
    { value: 'water-heater', label: 'Water Heater' },
    { value: 'other-appliance', label: 'Other' },
  ],
  other: [],
};

export function getSubTypesForType(type: PropertyType | null | undefined): { value: PropertySubType; label: string }[] {
  if (!type || type === 'other') {
    return [];
  }
  return PROPERTY_SUB_TYPES[type] || [];
}
