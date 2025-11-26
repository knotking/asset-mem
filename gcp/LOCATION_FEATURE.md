# Location-Based Service Provider Search Feature

## Overview

This feature adds location data support (latitude, longitude, and radius) to identify service providers when property address information is missing. The system now supports two methods for location-based searches:

1. **Property Address** (primary): Uses the property address from property details
2. **Location Coordinates** (fallback): Uses GPS coordinates (latitude/longitude) with a configurable radius (default: 50 miles) when property address is not available

## Implementation Details

### Backend Changes

#### Proxy API (`gcp/proxy/api/`)

1. **Models** (`models.py`):
   - Added `location_latitude`, `location_longitude`, and `location_radius_miles` fields to `AgentRequest` model
   - These fields are optional and used when `property_address` is missing

2. **Request Handling** (`main.py`):
   - Updated `_extract_firebase_request_data` to extract location fields from incoming requests
   - Location fields are passed through to the agent request

3. **Vertex Client** (`vertex_client.py`):
   - Updated `stream_agent_answers` to handle location data
   - Logic: Use `property_address` if available, otherwise use location coordinates with radius (default: 50 miles)
   - Location data is included in the payload sent to AI agents

#### AI Agents (`gcp/agents/homecare/property_agent/`)

1. **Input Schemas** (`agent_inputs.py`):
   - Added location fields to both `DiagnosisInput` and `DocsInput` schemas:
     - `location_latitude` (Optional[float])
     - `location_longitude` (Optional[float])
     - `location_radius_miles` (Optional[float], default: 50)

2. **Service Agent** (`sub_agents/service_agent/`):
   - Updated prompts to handle location data
   - Uses property address if available, otherwise uses location coordinates
   - Formats search queries appropriately based on available location data
   - Searches within the specified radius (default: 50 miles)

3. **Analysis Agent** (`sub_agents/analysis_agent/`):
   - Updated prompts to pass location data to service agent
   - Handles location fallback logic

### Frontend Changes

#### Web App (`apps/webapp/`)

1. **Chat Page** (`src/app/home/properties/[propertyId]/chat/[sessionId]/page.tsx`):
   - Added geolocation API call when property address is missing
   - Requests user location permission
   - Sends location coordinates (latitude, longitude) with 50-mile radius to backend
   - Falls back gracefully if location permission is denied

#### Mobile App (`apps/mapp/`)

1. **Package Dependencies** (`package.json`):
   - Added `expo-location` package for location access

2. **App Configuration** (`app.config.js`):
   - Added iOS location permissions:
     - `NSLocationWhenInUseUsageDescription`
     - `NSLocationAlwaysAndWhenInUseUsageDescription`
   - Added Android location permissions:
     - `ACCESS_FINE_LOCATION`
     - `ACCESS_COARSE_LOCATION`

3. **Property Details Screen** (`app/(tabs)/home/property-details/index.tsx`):
   - Added location request when property address is missing
   - Uses Expo Location API to get current position
   - Sends location coordinates with 50-mile radius to backend
   - Handles permission errors gracefully

4. **API Client** (`lib/api.ts`):
   - Updated `StreamAgentResponseParams` interface to include location fields
   - Updated `streamAgentResponse` function to include location data in request body
   - Logic: Use property address if available, otherwise use location coordinates

## Usage Flow

1. **User sends a message** requesting service provider recommendations
2. **System checks for property address**:
   - If property address exists → Use property address for location-based search
   - If property address is missing → Request user location
3. **Location request**:
   - Web: Uses browser Geolocation API
   - Mobile: Uses Expo Location API
4. **Backend processing**:
   - Proxy receives request with either property address or location coordinates
   - Passes location data to AI agents
   - Service agent uses location data to search for providers within specified radius
5. **Results**: Service providers are returned within the specified radius (default: 50 miles)

## API Request Format

### With Property Address (Primary)
```json
{
  "user_id": "user123",
  "session_id": "session456",
  "user_query": "Find a plumber",
  "property_address": "123 Main St, Springfield, IL"
}
```

### With Location Coordinates (Fallback)
```json
{
  "user_id": "user123",
  "session_id": "session456",
  "user_query": "Find a plumber",
  "location_latitude": 39.7817,
  "location_longitude": -89.6501,
  "location_radius_miles": 50
}
```

## Default Values

- **Default Radius**: 50 miles (when not specified)
- **Location Accuracy**: 
  - Web: Standard browser geolocation accuracy
  - Mobile: Standard GPS accuracy

## Error Handling

- If location permission is denied, the system continues without location data
- If location cannot be retrieved, the system falls back to generic "near me" searches
- All location-related errors are logged but do not block the request

## Documentation Updates

- Updated `gcp/agents/homecare/property_agent/README.md` with location fields in input schemas
- Updated `gcp/agents/homecare/property_agent/sub_agents/analysis_agent/README.md` with location handling notes
- Updated service agent prompts to include location handling instructions

## Testing

To test the location feature:

1. **With Property Address**: Create a property with an address and send a service request
2. **Without Property Address**: Create a property without an address and send a service request (should prompt for location)
3. **Permission Denial**: Deny location permission and verify graceful fallback

## Future Enhancements

- Allow users to manually set location/radius preferences
- Cache location data to reduce permission requests
- Support multiple location sources (GPS, IP-based, manual entry)
- Allow users to adjust search radius per request

