# Location-Based Service Agent Testing Guide

This document outlines the testing scenarios for the location-based service agent feature.

## Overview

The location-based service agent feature enables users to find service providers using either:
1. **Current Location**: User's real-time GPS coordinates
2. **Property Address**: Property address geocoded to coordinates

Both options support radius-based search (10-100 miles) for precise filtering.

## Testing Scenarios

### 1. Geocoding Service Tests

#### 1.1 Successful Geocoding
**Test**: Geocode a valid address to coordinates
```python
# Input
address = "1600 Amphitheatre Parkway, Mountain View, CA"

# Expected Output
lat = 37.4224764
lng = -122.0842499
formatted_address = "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA"
success = True
```

**How to Test**:
```bash
cd gcp/common/geocoding
pytest tests/test_client.py::test_geocode_success -v
```

#### 1.2 Invalid Address Handling
**Test**: Geocode an invalid address
```python
# Input
address = "invalid address xyz123"

# Expected Output
success = False
error_message = "No results found for the address"
```

**How to Test**:
```bash
pytest tests/test_client.py::test_geocode_zero_results -v
```

#### 1.3 Caching Behavior
**Test**: Verify geocoding results are cached
```python
# First call - hits API
response1 = await client.geocode("123 Main St")

# Second call - uses cache (no API call)
response2 = await client.geocode("123 Main St")

assert response1.lat == response2.lat
```

**How to Test**:
```bash
pytest tests/test_client.py::test_geocode_caching -v
```

### 2. Backend Integration Tests

#### 2.1 Address Geocoding in Proxy Layer
**Test**: Verify address is geocoded when location_type is "address"

**Request**:
```json
{
  "user_id": "test-user",
  "session_id": "test-session",
  "user_query": "Find a plumber near me",
  "property_address": "123 Main St, San Francisco, CA",
  "location_type": "address",
  "location_radius": 50
}
```

**Expected Behavior**:
1. Proxy layer geocodes the address to coordinates
2. Coordinates are added to the payload: `{"lat": 37.7749, "lng": -122.4194}`
3. Both address and coordinates are passed to agent
4. Default radius of 50 miles is applied

**Manual Test**:
1. Start the proxy service
2. Send request to `/api/agent/stream` endpoint
3. Check logs for: "Successfully geocoded address"
4. Verify coordinates are in the agent payload

#### 2.2 Current Location Handling
**Test**: Verify current location coordinates are passed through

**Request**:
```json
{
  "user_id": "test-user",
  "session_id": "test-session",
  "user_query": "Find a plumber near me",
  "location_type": "location",
  "location_coordinates": {"lat": 37.7749, "lng": -122.4194},
  "location_radius": 25
}
```

**Expected Behavior**:
1. Coordinates are passed directly to agent (no geocoding)
2. Radius of 25 miles is applied
3. Agent uses coordinates for precise search

#### 2.3 Fallback Scenarios
**Test**: Verify fallback when geocoding fails

**Scenario 1**: Geocoding API unavailable
```
Input: location_type="address", property_address="123 Main St"
Expected: Falls back to address-only search (no coordinates)
```

**Scenario 2**: No API key configured
```
Input: location_type="address", property_address="123 Main St"
Expected: Warning logged, falls back to address-only search
```

**Scenario 3**: No location data provided
```
Input: No location_type, no coordinates, no address
Expected: Agent uses "near me" as fallback
```

### 3. Agent Behavior Tests

#### 3.1 Coordinates with Radius (Priority 1)
**Test**: Verify agent prioritizes coordinates when available

**Input to Service Agent**:
```json
{
  "user_query": "I need a plumber",
  "property_address": "123 Main St, San Francisco, CA",
  "location_coordinates": {"lat": 37.7749, "lng": -122.4194},
  "location_radius": 50
}
```

**Expected Agent Behavior**:
1. Uses coordinates with radius for SerpAPI: "plumber near 37.7749,-122.4194 within 50 miles"
2. Uses coordinates with radius for Yelp: "plumber 37.7749,-122.4194 within 50 miles"
3. Filters results to within 50-mile radius
4. Sorts results by distance (closest first)

#### 3.2 Address Only (Priority 2)
**Test**: Verify agent uses address when coordinates not available

**Input to Service Agent**:
```json
{
  "user_query": "I need a plumber",
  "property_address": "123 Main St, San Francisco, CA"
}
```

**Expected Agent Behavior**:
1. Uses address for SerpAPI: "plumber near 123 Main St, San Francisco, CA"
2. Uses address for Yelp: "plumber 123 Main St, San Francisco, CA"
3. Results based on address proximity (less precise)

#### 3.3 No Location (Priority 3)
**Test**: Verify agent fallback when no location data

**Input to Service Agent**:
```json
{
  "user_query": "I need a plumber"
}
```

**Expected Agent Behavior**:
1. Uses generic search: "plumber repair service near me"
2. Results based on API's default location detection

### 4. Frontend UI Tests

#### 4.1 Webapp Location Selection
**Test**: Verify location UI in webapp

**Steps**:
1. Open chat interface in webapp
2. Click location button
3. Select "Address" option
4. Verify:
   - Property address is displayed
   - Radius slider shows (10-100 miles)
   - Info message: "Using property address for location-based search. The address will be geocoded to coordinates for precise radius filtering."

5. Select "Current Location" option
6. Click "Use Current Location"
7. Verify:
   - Browser requests location permission
   - Coordinates are displayed when granted
   - Success message shows: "✓ Location set: lat, lng"
   - Radius slider is visible

#### 4.2 Mapp Location Selection
**Test**: Verify location UI in mobile app

**Steps**:
1. Open chat interface in mapp
2. Tap location button
3. Select "Address" option
4. Verify:
   - Property address is displayed
   - Radius slider shows (10-100 miles)
   - Info message appears

5. Select "Current Location" option
6. Tap "Use Current Location"
7. Verify:
   - App requests location permission
   - Coordinates are displayed when granted
   - Success message shows
   - Radius slider is visible

### 5. End-to-End Integration Tests

#### 5.1 Complete Flow with Address
**Test**: Full flow from UI to agent response

**Steps**:
1. Select property with address "1600 Amphitheatre Parkway, Mountain View, CA"
2. Select "Address" location type
3. Set radius to 50 miles
4. Send query: "Find a plumber"
5. Verify:
   - Address is geocoded to (37.4224764, -122.0842499)
   - Agent receives coordinates and radius
   - Results are within 50 miles of coordinates
   - Results are sorted by distance

#### 5.2 Complete Flow with Current Location
**Test**: Full flow using current location

**Steps**:
1. Select "Current Location" type
2. Grant location permission
3. Verify coordinates are captured
4. Set radius to 25 miles
5. Send query: "Find an electrician"
6. Verify:
   - Coordinates are passed to agent
   - Results are within 25 miles
   - Results are sorted by distance

### 6. Error Handling Tests

#### 6.1 Geocoding Failures
**Test**: Verify graceful handling of geocoding errors

**Scenarios**:
- API quota exceeded → Falls back to address-only search
- Invalid API key → Falls back to address-only search
- Network timeout → Falls back to address-only search
- Invalid address → Falls back to address-only search

#### 6.2 Location Permission Denied
**Test**: Verify handling when user denies location permission

**Expected Behavior**:
- Alert shown: "Permission to access location was denied"
- Location type remains unset
- User can still select "Address" option

### 7. Performance Tests

#### 7.1 Geocoding Response Time
**Test**: Verify geocoding completes within timeout

**Expected**:
- Geocoding completes within 10 seconds (configurable)
- Timeout triggers fallback to address-only search

#### 7.2 Caching Effectiveness
**Test**: Verify caching reduces API calls

**Expected**:
- First geocode of address: API call made
- Subsequent geocodes of same address: Cache hit (no API call)
- Cache persists for session duration

## Running All Tests

### Backend Tests
```bash
# Geocoding service tests
cd gcp/common/geocoding
pytest tests/ -v

# Integration tests (if available)
cd gcp/proxy
pytest tests/test_vertex_service.py -v -k location
```

### Frontend Tests
```bash
# Webapp tests (if available)
cd apps/webapp
npm test -- --testPathPattern=chat-input

# Mapp tests (if available)
cd apps/mapp
npm test -- --testPathPattern=GiftedChatInputToolbar
```

## Test Checklist

- [ ] Geocoding service unit tests pass
- [ ] Address geocoding works in proxy layer
- [ ] Current location coordinates pass through correctly
- [ ] Default radius of 50 miles is applied
- [ ] Agent prioritizes coordinates over address
- [ ] Agent falls back to address when no coordinates
- [ ] Agent uses "near me" when no location data
- [ ] Webapp location UI displays correctly
- [ ] Mapp location UI displays correctly
- [ ] Radius slider works for both location types
- [ ] Geocoding errors are handled gracefully
- [ ] Location permission denial is handled
- [ ] Results are filtered within specified radius
- [ ] Results are sorted by distance when using coordinates
- [ ] Caching reduces redundant API calls

## Environment Setup for Testing

### Required Environment Variables
```bash
# For geocoding tests
export GOOGLE_MAPS_API_KEY="your-api-key"
export GEOCODING_TIMEOUT="10"

# For proxy tests
export GEMINI_PROJECT_ID="your-project-id"
export GEMINI_LOCATION="us-central1"
```

### Test Data
- Valid address: "1600 Amphitheatre Parkway, Mountain View, CA"
- Invalid address: "invalid address xyz123"
- Test coordinates: {"lat": 37.7749, "lng": -122.4194} (San Francisco)
- Test radius values: 10, 25, 50, 75, 100 miles

## Known Issues and Limitations

1. **Geocoding API Quota**: Google Maps Geocoding API has usage limits. Monitor quota usage.
2. **Browser Location Permission**: Some browsers require HTTPS for geolocation API.
3. **Mobile Location Accuracy**: GPS accuracy varies based on device and environment.
4. **Caching Duration**: Cache is session-based and cleared when client is closed.

## Future Enhancements

1. Add persistent caching (Redis/Memcached)
2. Add geocoding retry logic with exponential backoff
3. Support reverse geocoding (coordinates to address)
4. Add location history for quick selection
5. Support multiple location presets per property

