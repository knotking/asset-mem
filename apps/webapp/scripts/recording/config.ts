import * as dotenv from 'dotenv';
import * as path from 'path';
import { devices, type DeviceDescriptor } from 'playwright';

// Load environment variables from .env.recording if it exists
dotenv.config({ path: path.join(process.cwd(), '.env.recording') });

export interface RecordingConfig {
  baseUrl: string;
  email: string;
  password: string;
  outputDir: string;
  sessionStoragePath: string;
  videoSettings: {
    width: number;
    height: number;
    fps: number;
  };
  /** Subtle click zoom in post-process (keep level low to avoid cropping copy). */
  zoomEffects: {
    enabled: boolean;
    zoomLevel: number;
    zoomDurationSec: number;
    minGapBetweenZoomsSec: number;
  };
  timing: {
    landingPage: number;
    login: number;
    dashboard: number;
    propertyDetails: number;
    aiChat: number;
    timeline: number;
    documents: number;
    defaultDelay: number;
    scrollDelay: number;
    hoverDelay: number;
    navigationWait: number;
  };
  devices: {
    mobile: DeviceDescriptor;
    tablet: DeviceDescriptor;
  };
  selectors: {
    landing: {
      watchDemoButton: string;
      getStartedButton: string;
      loginButton: string;
      featuresSection: string;
    };
    login: {
      emailInput: string;
      passwordInput: string;
      submitButton: string;
    };
    dashboard: {
      propertyCard: string;
      propertyCardLink: string;
    };
    propertyDetails: {
      chatTab: string;
      timelineTab: string;
      detailsTab: string;
    };
    chat: {
      messageInput: string;
      sendButton: string;
      documentDrawer: string;
      sessionList: string;
    };
    timeline: {
      checkpointList: string;
      createCheckpointButton: string;
      checkpointCard: string;
    };
    documents: {
      uploadButton: string;
      documentList: string;
      uploadDialog: string;
    };
  };
}

export const config: RecordingConfig = {
  baseUrl: process.env.RECORDING_BASE_URL || 'https://homegeek.ai',
  email: process.env.RECORDING_EMAIL || '',
  password: process.env.RECORDING_PASSWORD || '',
  outputDir: process.env.RECORDING_OUTPUT_DIR || path.join(process.cwd(), 'recordings'),
  sessionStoragePath: path.join(process.cwd(), 'recordings', '.session'),
  videoSettings: {
    width: 1920,
    height: 1080,
    fps: 30,
  },
  zoomEffects: {
    enabled:
      process.env.RECORDING_ZOOM_ENABLED === '1' ||
      process.env.RECORDING_ZOOM_ENABLED?.toLowerCase() === 'true',
    zoomLevel: Number(process.env.RECORDING_ZOOM_LEVEL) || 1.2,
    zoomDurationSec: Number(process.env.RECORDING_ZOOM_DURATION_SEC) || 1.0,
    minGapBetweenZoomsSec: 3.0,
  },
  timing: {
    landingPage: 15000, // 15 seconds
    login: 15000, // 15 seconds
    dashboard: 20000, // 20 seconds
    propertyDetails: 15000, // 15 seconds
    aiChat: 55000, // 55 seconds
    timeline: 40000, // 40 seconds
    documents: 40000, // 40 seconds
    defaultDelay: 1000, // 1 second default delay
    scrollDelay: 500, // 500ms for scroll animations
    hoverDelay: 800, // 800ms for hover effects
    navigationWait: 3000, // 3 seconds for navigation
  },
  devices: {
    mobile: devices['iPhone 14 Pro'],
    tablet: devices['iPad Pro'],
  },
  selectors: {
    landing: {
      watchDemoButton: 'text="Watch Demo"',
      getStartedButton: 'text="Get Started"',
      loginButton: 'text="Login"',
      featuresSection: '#features',
    },
    login: {
      emailInput: '#email',
      passwordInput: '#password',
      submitButton: 'button[type="submit"]',
    },
    dashboard: {
      propertyCard: '[data-testid="property-card"], a[href*="/properties/"]',
      propertyCardLink: 'a[href*="/properties/"]',
    },
    propertyDetails: {
      chatTab: 'a[href*="/chat"]',
      timelineTab: 'a[href*="/checkpoints"]',
      detailsTab: 'a[href*="/details"]',
    },
    chat: {
      messageInput: 'textarea, input[type="text"]',
      sendButton: 'button:has-text("Send"), button[type="submit"]',
      documentDrawer: '[data-testid="document-drawer"], button:has-text("Documents")',
      sessionList: '[data-testid="session-list"], [aria-label*="session"]',
    },
    timeline: {
      checkpointList: '[data-testid="checkpoint-list"]',
      createCheckpointButton: 'button:has-text("Create Checkpoint"), button:has-text("New Checkpoint")',
      checkpointCard: '[data-testid="checkpoint-card"]',
    },
    documents: {
      uploadButton: 'button:has-text("Upload Documents"), button:has-text("Upload")',
      documentList: '[data-testid="document-list"]',
      uploadDialog: '[role="dialog"]:has-text("Upload")',
    },
  },
};

// Validate required configuration
if (!config.email || !config.password) {
  console.warn('⚠️  RECORDING_EMAIL and RECORDING_PASSWORD not set in .env.recording');
  console.warn('   Create .env.recording file with:');
  console.warn('   RECORDING_EMAIL=your@email.com');
  console.warn('   RECORDING_PASSWORD=yourpassword');
}

