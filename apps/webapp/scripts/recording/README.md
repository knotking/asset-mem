# Automated Video Recording Scripts

This directory contains Playwright-based automation scripts that automatically navigate through the HomeApp webapp and record videos for demo purposes. The scripts follow the flows described in the [Demo Video Recording Guide](../docs/DEMO_VIDEO_RECORDING_GUIDE.md).

## Overview

The recording scripts automate the entire demo video recording process:
- Walk the full marketing landing page (use cases, features, reports, AI agents, timeline, docs chat, how it works, pricing)
- Navigate through all key in-app features of the webapp
- Record high-quality videos (1920x1080)
- Support both desktop and mobile device emulation
- Save and reuse authentication sessions
- Generate videos ready for YouTube upload

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Playwright browsers** (installed automatically)

## Setup

### 1. Install Dependencies

```bash
cd apps/webapp
npm install
```

This will install Playwright and all required dependencies.

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3. Configure Environment

Create a `.env.recording` file in the `apps/webapp` directory:

```bash
RECORDING_EMAIL=your-test-account@example.com
RECORDING_PASSWORD=your-password
RECORDING_BASE_URL=https://homegeek.ai
RECORDING_OUTPUT_DIR=./recordings
# Optional: post-process click zoom effects (off by default)
# RECORDING_ZOOM_ENABLED=true
# RECORDING_ZOOM_LEVEL=1.2
# RECORDING_ZOOM_DURATION_SEC=1.0
```

**Important**: Add `.env.recording` to `.gitignore` to avoid committing credentials.

### 4. Prepare Test Account

Ensure your test account has:
- At least 2-3 properties
- Multiple documents per property
- Several chat sessions with AI interactions
- 2-3 checkpoints with photos
- Mix of property types (real estate, vehicle, appliance)

## Usage

### Record Webapp Flow

Records the desktop webapp experience:

```bash
npm run record:webapp
```

This will:
1. Launch a browser window
2. Navigate through all scenes
3. Record video automatically
4. Save video to `recordings/` directory

Click zoom post-processing is **off by default**. Enable with `--zoom` or `RECORDING_ZOOM_ENABLED=true` in `.env.recording`:

```bash
npm run record:webapp -- --zoom
```

### Record Mobile Emulation

Records the mobile app experience using device emulation:

```bash
npm run record:mobile
```

This uses iPhone 14 Pro emulation to simulate the mobile experience.

### Record Both

Records both webapp and mobile flows sequentially:

```bash
npm run record:all
```

## Output

Videos are saved to the `recordings/` directory:
- `webapp-recording.webm` - Desktop webapp recording
- Mobile recording files - Mobile emulation recordings

The videos are in WebM format and can be:
- Uploaded directly to YouTube
- Converted to MP4 using tools like FFmpeg
- Edited in video editing software

## Scene Breakdown

The scripts record the following scenes (matching the demo guide):

1. **Landing Page** (15s)
   - Hero section scroll
   - "Watch Demo" button highlight
   - Features section
   - CTA buttons

1b. **Landing Page Static** (10s) — option `9` in `record:webapp`
   - Loads the marketing landing page and holds on the hero with no scroll or clicks

1c. **Save Provider & My Pros** — option `10` in `record:webapp`
   - Ask "Find local service pros" with Service agent enabled
   - Open full report sheet, save at least 3 local pros
   - Navigate to Details tab and open My pros (full recording kept, no wait-cut)

2. **Login** (15s)
   - Navigate to login
   - Fill credentials
   - Submit and redirect

3. **Properties Dashboard** (20s)
   - Property cards display
   - Hover effects
   - Navigate to property

4. **Property Details** (15s)
   - Property information
   - Tab navigation (AI Chat, Timeline, Details)

5. **AI Chat** (55s)
   - Chat interface
   - Type question
   - Document selection
   - Send message

6. **Timeline** (40s)
   - Checkpoint list
   - View checkpoint details
   - Create new checkpoint

7. **Documents** (40s)
   - Documents section
   - Upload dialog
   - File selection

## Configuration

Edit `config.ts` to customize:
- Timing delays for each scene
- Video resolution and frame rate
- Device emulation settings
- UI selectors
- Output directory

## Session Management

The scripts automatically save and reuse browser sessions:
- First run: Authenticates and saves session
- Subsequent runs: Loads saved session (faster startup)
- Session stored in: `recordings/.session`

To force re-authentication, delete the `.session` file.

## Troubleshooting

### Browser doesn't launch

```bash
# Reinstall Playwright browsers
npx playwright install chromium --force
```

### Authentication fails

- Verify credentials in `.env.recording`
- Check that the test account exists and is active
- Delete `recordings/.session` to force re-authentication

### Selectors not found

- The app UI may have changed
- Update selectors in `config.ts`
- Check browser console for errors

### Video not recording

- Ensure `recordings/` directory exists and is writable
- Check disk space
- Verify Playwright video recording is enabled in script

### Slow performance

- Reduce `slowMo` in recording scripts (default: 100ms)
- Adjust timing delays in `config.ts`
- Close other applications

## Customization

### Adjust Timing

Edit `config.ts` to change scene durations:

```typescript
timing: {
  landingPage: 15000,  // 15 seconds
  login: 15000,
  // ... etc
}
```

### Change Video Settings

```typescript
videoSettings: {
  width: 1920,
  height: 1080,
  fps: 30,
}
```

### Use Different Device

Edit device emulation in `config.ts`:

```typescript
devices: {
  mobile: devices['iPhone 14 Pro'],
  tablet: devices['iPad Pro'],
}
```

### Record Individual Scenes

You can import and use individual scene functions:

```typescript
import { recordLandingPage } from './scenes/landing-page';

// In your script
await recordLandingPage(page);
```

## Advanced Usage

### Record Specific Scenes Only

Modify `record-webapp.ts` to comment out unwanted scenes:

```typescript
const scenes = [
  { name: 'Landing Page', fn: () => recordLandingPage(page!) },
  // { name: 'Login', fn: () => recordLogin(page!, context!) },
  // ... comment out scenes you don't need
];
```

### Add Custom Delays

Add delays between actions in scene scripts:

```typescript
await delay(2000); // Wait 2 seconds
```

### Take Screenshots

Use the screenshot helper:

```typescript
import { takeScreenshot } from './helpers';

await takeScreenshot(page, 'scene-name');
```

## File Structure

```
scripts/recording/
├── config.ts              # Configuration
├── helpers.ts             # Utility functions
├── scenes/
│   ├── landing-page.ts
│   ├── login.ts
│   ├── dashboard.ts
│   ├── property-onboarding.ts
│   ├── property-details.ts
│   ├── ai-chat.ts         # Analysis chat (record-mobile.ts)
│   ├── checkpoint-chat.ts # Checkpoint agent chat (record-webapp.ts)
│   ├── save-provider-my-pros.ts # Save pro from chat sheet → Details My pros
│   ├── timeline-checkpoint.ts
│   ├── timeline-compare.ts
│   ├── timeline-insights.ts
│   ├── timeline-reports.ts # PDF report wizard (record-webapp.ts)
│   ├── timeline.ts        # Combined timeline flow (record-mobile.ts)
│   └── documents.ts
├── record-webapp.ts       # Webapp recorder (interactive scene picker)
├── record-mobile.ts       # Mobile viewport recorder
├── record-all.ts          # Orchestrator
└── README.md              # This file
```

## Converting Videos

### WebM to MP4 (using FFmpeg)

```bash
ffmpeg -i recordings/webapp-recording.webm -c:v libx264 -c:a aac recordings/webapp-recording.mp4
```

### Adjust Quality

```bash
ffmpeg -i recordings/webapp-recording.webm \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  recordings/webapp-recording.mp4
```

## Best Practices

1. **Test First**: Run scripts on staging/test environment first
2. **Clean State**: Start with a fresh browser session for consistent results
3. **Monitor**: Watch the browser during recording to catch issues
4. **Review**: Check recorded videos before uploading
5. **Update**: Keep selectors updated as UI changes

## Support

For issues or questions:
1. Check the [Demo Video Recording Guide](../docs/DEMO_VIDEO_RECORDING_GUIDE.md)
2. Review Playwright documentation: https://playwright.dev
3. Check browser console for errors
4. Verify test account has required data

## Notes

- Videos are recorded in WebM format (Playwright default)
- Browser runs in non-headless mode so you can see the recording
- Session is saved to avoid re-authentication on subsequent runs
- Scripts include error handling and continue on non-critical failures
- Timing matches the demo video recording guide specifications

