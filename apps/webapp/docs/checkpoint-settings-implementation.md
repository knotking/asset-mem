# Checkpoint Settings Implementation in WebApp

## Overview
Added checkpoint settings functionality to the webapp, matching the implementation available in the mobile app (mapp). Users can now adjust checkpoint comparison settings from a dedicated settings page.

## Changes Made

### 1. Created Settings Page
**File:** `apps/webapp/src/app/home/settings/page.tsx`

- New page accessible at `/home/settings`
- Displays user profile information
- Integrates the CheckpointSettings component
- Follows the same structure as the mapp settings screen

### 2. Updated Header Navigation
**File:** `apps/webapp/src/components/layout/header.tsx`

- Made the Settings icon button functional - now navigates to `/home/settings`
- Added Settings menu item in the user dropdown menu with proper icon
- Both entry points navigate to the new settings page

### 3. Enhanced Checkpoint Settings Component
**File:** `apps/webapp/src/components/settings/checkpoint-settings.tsx`

Updated to match mapp implementation:
- Added loading state with skeleton UI
- Added Camera icon to the card header
- Changed "Minimum Room Confidence" to "Minimum Asset Confidence" for consistency
- Updated descriptive text to match mapp wording
- Improved info box styling and messaging
- Made descriptions dynamic (e.g., shows current values in the description text)

## Features Available

### Checkpoint Comparison Settings
Users can adjust the following settings:

1. **Enable/Disable Automatic Comparison**
   - Master toggle for the checkpoint comparison feature
   - When enabled, new checkpoints are automatically compared with previous ones

2. **Maximum Age (Days)**
   - Range: 30-365 days (in 30-day increments)
   - Default: 180 days
   - Only compares with checkpoints within this time window

3. **Minimum Asset Confidence**
   - Range: 0-100% (in 10% increments)
   - Default: 30%
   - Only performs comparison when asset detection confidence meets this threshold

## Integration

The checkpoint settings are:
- Stored in Firestore under `users/{userId}/preferences/user`
- Managed by the PreferencesProvider context (already integrated in the app)
- Automatically synced across all user sessions
- Applied to all future checkpoint operations

## User Experience

1. Users can access settings via:
   - Settings icon button in the header (top right)
   - Settings option in the user profile dropdown menu

2. Settings changes are:
   - Saved immediately when adjusted (no save button needed for webapp)
   - Persisted to Firestore
   - Applied to all future checkpoints

3. Loading states are handled gracefully with skeleton UI

## Consistency with Mobile App

The implementation maintains feature parity with the mobile app (mapp):
- Same settings available
- Same default values
- Same range and step values for sliders
- Similar UI/UX adapted for web
- Same backend integration (Firestore preferences)

## Notes

- The webapp uses continuous updates (settings save immediately on change)
- The mapp uses a "Save Changes" button pattern for better mobile UX
- Both approaches use the same backend Firestore structure
- Settings affect all checkpoint operations going forward
- Existing checkpoints and comparisons are not affected by settings changes
