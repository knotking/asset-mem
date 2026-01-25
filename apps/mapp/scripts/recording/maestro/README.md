# Maestro Mobile App Recording

This directory contains Maestro flows for recording the mobile app (mapp) user interactions using **Expo Go**.

## Prerequisites

1. **Install Maestro**:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Install Expo Go**:
   - **iOS**: Install Expo Go from App Store on the iOS Simulator
   - **Android**: Install Expo Go from Play Store on the Android Emulator

3. **iOS Setup** (for iOS recording):
   - Xcode installed
   - iOS Simulator available
   - Expo Go installed on simulator

4. **Android Setup** (for Android recording):
   - Android Studio installed
   - Android Emulator available
   - Expo Go installed on emulator

5. **Expo Dev Server**:
   - Start the Expo dev server before recording:
   ```bash
   cd apps/mapp
   npm run dev
   ```

## App ID Configuration

The script uses **Expo Go** bundle ID: `host.exp.Exponent`

All Maestro flows are configured to work with Expo Go. The script will automatically:
- Launch Expo Go on the simulator/emulator
- Open your app using the Expo URL (default: `exp://localhost:8081`)

## Expo URL Configuration

Set the Expo URL if your dev server is running on a different address:

```bash
export EXPO_URL=exp://192.168.1.100:8081
npm run record
```

Or use the URL from the QR code shown when you run `npm run dev`.

## Running Recordings

1. **Start Expo dev server** (in a separate terminal):
   ```bash
   cd apps/mapp
   npm run dev
   ```
   Note the Expo URL (e.g., `exp://localhost:8081` or from QR code)

2. **Run the recording script**:
   ```bash
   cd apps/mapp
   npm run record
   ```

3. **Optional**: Set EXPO_URL if different from default:
   ```bash
   export EXPO_URL=exp://192.168.1.100:8081
   npm run record
   ```

The script will:
1. Check if Maestro is installed
2. Prompt for platform (iOS/Android)
3. Prompt for scenes to record
4. Launch Expo Go on simulator/emulator
5. Open your app in Expo Go using the Expo URL
6. Start screen recording
7. Run Maestro flows sequentially
8. Stop screen recording
9. Save video and narration data

## Available Flows

- **login.yaml**: Login flow with email/password
- **dashboard.yaml**: View properties dashboard
- **property-details.yaml**: Navigate to property details
- **chat.yaml**: Interact with AI chat
- **timeline.yaml**: View timeline/checkpoints

## Flow Structure

Maestro flows use YAML format with environment variables:
- `${APP_ID}`: App bundle ID
- `${EMAIL}`: Login email (from config)
- `${PASSWORD}`: Login password (from config)

## Customizing Flows

Edit the YAML files in `flows/` directory to customize interactions:
- Change selectors/text matchers
- Add/remove steps
- Adjust wait times
- Add assertions

## Output

Recordings are saved to:
- Video: `apps/mapp/recordings/mapp-recording-{platform}-{timestamp}.mp4`
- Narration: `apps/mapp/recordings/mapp-narration-data-{timestamp}.json`

## Troubleshooting

1. **Maestro not found**: Install Maestro using the command above
2. **App not launching**: Ensure app is installed on simulator/emulator
3. **Flows failing**: Check that selectors match current app UI
4. **Screen recording issues**: Ensure simulator/emulator is running
