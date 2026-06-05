import type { Timestamp } from "firebase/firestore";

export const PROPERTY_TYPES = [
  "House",
  "Apartment",
  "Condo",
  "Townhouse",
  "Land",
  "Other",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type AgentStep = {
  /** Raw tool/agent name as emitted by ADK (kept as the unique key). */
  name: string;
  status: "executing" | "completed" | "failed";
  /** Human-friendly label, e.g. "Finding local pros". */
  displayName?: string;
  /** One-line summary of what the step actually produced, e.g. "Found 8 plumbers in 5-mile radius". */
  preview?: string;
  /** Optional secondary line, e.g. "Yelp + SerpAPI". */
  detail?: string;
  /** Epoch ms when the step first appeared. */
  startedAt?: number;
  /** Epoch ms when the step transitioned to completed/failed. */
  completedAt?: number;
};

export const ANALYSIS_OPTIONAL_AGENTS = [
  "coverage",
  "diy",
  "service",
  "cost",
] as const;

export type AnalysisOptionalAgent = (typeof ANALYSIS_OPTIONAL_AGENTS)[number];

export const CHECKPOINT_OPTIONAL_AGENTS = [
  "coverage",
  "diy",
  "service",
  "cost",
] as const;

export type CheckpointOptionalAgent = (typeof CHECKPOINT_OPTIONAL_AGENTS)[number];

export type PrimaryAgent = 'analysis' | 'checkpoint' | 'docs';

export type FileAttachment = {
  id: string;
  uri: string;
  progress: number;
  downloadURL: string | null;
  error: string | null;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  width?: number;
  height?: number;
  thumbnailUri?: string; // For video thumbnails
};

/** Persisted lifecycle strip fields (see gcp/proxy/api/services/vertex_service.py). */
export type AgentLifecycle = {
  phase: string;
  message: string;
  ts?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  contentMarkdown?: string;
  contentJson?: StructuredResponseData | Record<string, unknown> | null;
  contentSchemaVersion?: number;
  revision?: number;
  createdAt?: Timestamp | Date;
  followUpQuestions?: string[];
  file?: {
    name: string;
    type: string;
    url: string;
    gsURI?: string;
    width?: number;
    height?: number;
  };
  contextRefs?: {
    checkpoints?: { id: string; name?: string }[];
    documents?: { id: string; name: string }[];
  };
  agentSteps?: AgentStep[];
  /** Early-turn status from proxy lifecycle persist (cleared when agentSteps arrive). */
  agentLifecycle?: AgentLifecycle | null;
  primaryAgent?: PrimaryAgent;
};

export type Session = {
  id: string;
  name: string;
  createdAt: Timestamp;
  /** Set when a draft is claimed or first promoted to a named session. */
  startedAt?: Timestamp;
  agentSessionId?: string;
  propertyId?: string | null;
  messageCount?: number;
  lastMessageAt?: Timestamp;
};

export type ServiceProvider = {
  name: string;
  contact_info: string;
  location: string;
  reviews: string;
  ratings: string;
  /** Miles from property/search anchor (SerpAPI maps ranking). */
  distance_miles?: string | null;
  directions: string | null;
  website: string | null;
  authorized: string;
  additional_information: string;
  specialties?: string;
  link?: string;
};

/** Saved-provider types; mirrored in `apps/webapp/src/lib/types.ts` for App Hosting. */
export type SavedServiceProviderSource = 'chat' | 'manual';

export type SaveServiceProviderMeta = {
  source?: SavedServiceProviderSource;
  sessionId?: string;
  messageId?: string;
  checkpointId?: string;
  searchContext?: string;
};

export type SavedServiceProvider = ServiceProvider & {
  id: string;
  propertyId: string;
  userId: string;
  dedupeKey: string;
  savedAt: Timestamp;
  source: SavedServiceProviderSource;
  sessionId?: string;
  messageId?: string;
  checkpointId?: string;
  searchContext?: string;
};

export type SaveServiceProviderResult = 'saved' | 'already_saved' | 'error';

export type Product = {
  /** DIY agent and shopping payloads use this as the primary label */
  item_name?: string | null;
  // legacy fields (kept for backward compatibility)
  product_name?: string;
  item_price?: string | null;
  image_url?: string | null;
  rating?: string | null;
  reviews?: string | null;
  // new structured fields
  vendor?: string | null;
  /** Canonical product page when present (shopping agent) */
  store_url?: string | null;
  url?: string | null;
  description?: string | null;
  price?: string | null;
};

/** DIY-only cost slice from the agent library (nested under analysis.diyResults). */
export type DiyCostEstimatesSummary = {
  repair_type?: string;
  DIY?: {
    cost_range?: string;
    includes?: string[];
    savings?: string;
    complexity?: string;
  };
};

export type ChatIntentHint = "discuss_report" | "new_analysis" | "replay_report";

export type SuggestedAction = {
  label: string;
  userQuery: string;
  chatIntent?: ChatIntentHint;
};

export type StructuredResponseData = {
  suggestedActions?: SuggestedAction[];
  // Top-level fields (for backward compatibility and flat structures)
  title?: string;

  // Legacy format (backward compatibility)
  researchResults?: {
    summaryOfFindings?: string;
    yourDocuments?: string;
    googleSearch?: string;
    youtubeSearch?: string;
  };
  serviceProviderResults?: {
    serpAPIResults?: ServiceProvider[];
    yelpAPIResults?: ServiceProvider[];
  };

  // Flat structure fields (alternative to nested analysis structure)
  triageResult?: {
    diagnosis?: string;
    needs_clarification?: boolean;
    message?: string;
    clarification_questions?: string[];
  };
  coverageResult?: {
    warrantyInfo?: string;
    insuranceInfo?: string;
  };
  diyResults?: {
    /** When true, UI should surface a stronger “hire a pro” warning. */
    hireProfessionalRecommended?: boolean;
    /** Some payloads use snake_case before synthesis normalizes. */
    hire_professional_recommended?: boolean;
    diyCostEstimates?: DiyCostEstimatesSummary;
    diySteps?: {
      summary?: string;
      steps?: Array<{ stepNumber: number; description: string }>;
    };
    youtubeSearch?: {
      videos?: Array<{ title: string; url: string; description?: string }>;
    };
    recommendedProducts?: {
      products?: Product[];
    };
  };
  serviceResults?: {
    costEstimates?: string;
    /** Present when provider search failed (e.g. SerpAPI quota). UI shows searchError. */
    searchStatus?: "failed" | "ok";
    searchError?: string;
    localPros?: {
      serpAPIResults?: ServiceProvider[];
      yelpAPIResults?: ServiceProvider[];
      googleSearchResults?: ServiceProvider[];
    };
  };

  // New format (nested structure)
  analysis?: {
    title?: string;
    triageResult?: {
      diagnosis?: string;
      needs_clarification?: boolean;
      message?: string;
      clarification_questions?: string[];
    };
    checkpointSummary?: {
      checkpointsAnalyzed?: number;
      issuesDetected?: string[];
      overallCondition?: string;
      locations?: string[];
      /** Property record address when provided on the checkpoint analysis request. */
      propertyAddress?: string;
      queryType?: "single" | "comparison" | "trend" | "location-specific";
      dateRange?: string;
    };
    checkpointDetails?: Array<{
      name?: string;
      location?: string;
      date?: string;
      summary?: string;
      detectedItems?: string[];
      conditions?: string[];
      issues?: string[];
      [key: string]: any; // Allow additional fields
    }>;
    insights?: {
      changes?: string;
      patterns?: string;
      recommendations?: string;
    };
    coverageResult?: {
      warrantyInfo?: string;
      insuranceInfo?: string;
    };
    diyResults?: {
      hireProfessionalRecommended?: boolean;
      hire_professional_recommended?: boolean;
      diyCostEstimates?: DiyCostEstimatesSummary;
      diySteps?: {
        summary?: string;
        steps?: Array<{ stepNumber: number; description: string }>;
      };
      youtubeSearch?: {
        videos?: Array<{ title: string; url: string; description?: string }>;
      };
      recommendedProducts?: {
        products?: Product[];
      };
    };
    serviceResults?: {
      costEstimates?: string;
      localPros?: {
        serpAPIResults?: ServiceProvider[];
        yelpAPIResults?: ServiceProvider[];
      };
    };
    costEstimationResults?: {
      costEstimates?: {
        repair_type?: string;
        DIY?: {
          cost_range?: string;
          includes?: string[];
          savings?: string;
          complexity?: string;
        };
        Service?: {
          cost_range?: string;
          includes?: string[];
          benefits?: string;
          complexity?: string;
        };
        comparison?: {
          diy_savings?: string;
          professional_benefits?: string;
          considerations?: string;
        };
      };
    };
    /** Per optional-agent progress during progressive checkpoint analysis (chat only). */
    analysisStatus?: Partial<
      Record<CheckpointOptionalAgent, "pending" | "running" | "completed">
    >;
  };
};

export type Document = {
  id: string;
  userId: string;
  propertyId: string;
  name: string;
  url: string;
  storagePath: string;
  createdAt: Timestamp;
  gsURI?: string;
  contentType?: string;
  summary?: string;
  documentType?:
    | "DEED"
    | "INSURANCE_POLICY"
    | "UTILITY_BILL"
    | "INSPECTION_REPORT"
    | "MORTGAGE_STATEMENT"
    | "OTHER";
  propertyAddress?: string;
  keyEntities?: { name: string; value: string }[];
  status?: "uploading" | "analyzing" | "complete" | "failed";
  ragIndexed?: boolean;
};

export type MessageContextRefs = NonNullable<Message["contextRefs"]>;

export type PendingCheckpointContext = {
  kind: "checkpoint";
  id: string;
  checkpointId: string;
  localPreviewUri?: string;
  status: "pending" | "processing" | "failed";
  label?: string;
};

export type PendingDocumentContext = {
  kind: "document";
  id: string;
  docId: string;
  localPreviewUri?: string;
  status: "uploading" | "analyzing" | "indexing" | "failed";
  label?: string;
};

export type PendingContextItem = PendingCheckpointContext | PendingDocumentContext;

export type QueuedChatSend = {
  text: string;
  waitForIds: string[];
  primaryAgent: PrimaryAgent;
};

export type Property = {
  id: string;
  userId: string;
  name: string;
  address: string;
  createdAt: Timestamp;
  propertyType?: string;
  propertySubType?: string;
  cityStateZip?: string;
  documents?: Document[];
  docIds?: string[];
  docGsURIs?: string[];
  docs?: number;
  services?: number;
  checks?: number;
  servicesCount?: number;
  checksCount?: number;
  checkpoints?: number;
  checkpointsCount?: number;
};

export type Checkpoint = {
  id: string;
  userId: string;
  propertyId: string;
  name: string; // e.g., "Monthly Inspection - Jan 2025"
  description?: string;
  createdAt: Timestamp;
  capturedAt?: Timestamp; // When the media was captured (vs when uploaded)
  media: CheckpointMedia[];
  assetType?: "real_estate" | "vehicle" | "appliance" | "other"; // User-selected asset type
  location?: string; // e.g., "Kitchen", "Living Room", "Exterior" (user-provided or auto-detected)
  detectedAsset?: string; // Auto-detected asset name from AI (e.g., "Kitchen", "Refrigerator", "Car")
  assetConfidence?: number; // 0-1 confidence score for asset detection
  assetFeatures?: string[]; // Key features that identify the asset (e.g., ["stove", "sink"] for kitchen, ["engine", "wheels"] for car)
  areaDescription?: string; // Detailed description of the detected area/asset
  tags?: string[]; // e.g., ["monthly", "winter", "pre-storm"]
  analysisStatus?: "pending" | "processing" | "completed" | "failed";
  /** Client or worker: user-facing reason when analysisStatus is failed */
  analysisFailureSummary?: string;
  analysisQuotaExceeded?: boolean;
  analysisCreationQuotaExceeded?: boolean;
  skipComparison?: boolean; // Opt-out of automatic comparison
  aiAnalysis?: CheckpointAnalysis;
  visualDiff?: VisualDiffAnalysis;
  // Vector embedding for semantic search (Firestore Vector Search)
  embedding?: number[]; // 768-dimensional vector from text-embedding-004
  embeddingModel?: string; // e.g., "text-embedding-004"
  embeddingGeneratedAt?: Timestamp; // When the embedding was generated
};

export type CheckpointMedia = {
  id: string;
  url: string;
  gsURI: string;
  contentType: string;
  storagePath: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
};

export type CheckpointAnalysis = {
  summary: string;
  detectedItems: string[]; // e.g., ["furniture", "appliances", "flooring"]
  conditions: string[]; // e.g., ["good", "minor wear", "damage detected"]
  // Backend may store either legacy strings OR structured issues with severity.
  issues?: Array<
    | string
    | {
        description?: string;
        severity?: "minor" | "moderate" | "major" | "critical";
        confidence?: number;
        category?: string;
      }
  >;
  // Optional worker-computed rollup (used by metrics aggregator)
  issues_by_severity?: {
    critical?: number;
    major?: number;
    moderate?: number;
    minor?: number;
  };
  aiConfidence?: number;
  analyzedAt: Timestamp;
};

export type VisualDiffAnalysis = {
  id: string;
  status: "processing" | "completed" | "failed";
  comparedWithCheckpointId?: string; // ID of the checkpoint this was compared with
  summary?: string;
  semanticChanges: string[]; // Gemini-generated descriptions
  heatmapUrl?: string; // URL to the generated overlay image
  regions: ChangeRegion[]; // Bounding boxes from Gemini
  similarityScore: number; // 0-1 score
  matchReason?: "same_location" | "same_detected_asset" | "manual";
  completedAt: Timestamp;
};

export type ChangeRegion = {
  id: string;
  bbox: { x: number; y: number; width: number; height: number }; // Bounding box
  changeType: "added" | "removed" | "modified";
  severity: "minor" | "moderate" | "major" | "critical";
  confidence: number; // 0-1 AI confidence
  description: string; // e.g., "Water staining detected", "New crack"
  changePercentage: number; // 0-100 how much this region changed
  damageType?:
    | "crack"
    | "water_damage"
    | "mold"
    | "paint_degradation"
    | "structural"
    | "other";
};

/** @deprecated Use SearchLocationSource */
export type LocationType = "address" | "location";

export type LocationCoordinates = {
  lat: number;
  lng: number;
};

/** @deprecated Use SearchLocationInput */
export type LocationData = {
  locationType?: LocationType;
  locationCoordinates?: LocationCoordinates;
  locationRadius?: number;
};

/** How market/geo was chosen before proxy resolution */
export type SearchLocationSource = "property_address" | "device_gps";

/** Client payload; proxy resolves to canonical search_location for agents */
export type SearchLocationInput = {
  source: SearchLocationSource;
  radiusMiles?: number;
  coordinates?: LocationCoordinates;
};

/** Resolved search location returned in API docs / future session persistence */
export type SearchLocation = {
  source: SearchLocationSource;
  radius_miles: number;
  coordinates: LocationCoordinates;
  label?: string;
};

export type CheckpointComparisonPreferences = {
  enabled: boolean; // Master switch for automatic comparison
  maxAgeDays: number; // Maximum age of previous checkpoint to compare with (default: 180)
  minAssetConfidence: number; // Minimum asset detection confidence to perform comparison (default: 0.3)
};

/** UI color scheme stored in Firestore (`users/{uid}/preferences/user`). */
export type ThemePreference = "light" | "dark";

export function parseThemePreference(
  value: unknown
): ThemePreference | null {
  return value === "light" || value === "dark" ? value : null;
}

export type UserPreferences = {
  checkpointComparison?: CheckpointComparisonPreferences;
  theme?: ThemePreference;
  /** Property used for home onboarding steps (pinned on first create). */
  onboardingPropertyId?: string;
  /** User hid the home onboarding checklist. */
  onboardingChecklistDismissed?: boolean;
  /** User opened AI Chat from the onboarding checklist. */
  onboardingChatOpened?: boolean;
  /** Per-tip dismissals for contextual feature education banners. */
  featureTipsDismissed?: Partial<
    Record<
      | "checkpoints_empty"
      | "checkpoints_compare"
      | "docs_linked_to_chat"
      | "chat_optional_agents"
      | "chat_multi_checkpoint"
      | "quota_limit"
      | "first_structured_response",
      boolean
    >
  >;
  /** User hid the post-onboarding discovery checklist on home. */
  discoveryChecklistDismissed?: boolean;
  discoveryCompareDone?: boolean;
  discoveryOptionalAgentUsed?: boolean;
  discoveryMultiCheckpointChat?: boolean;
  discoveryAiUsageViewed?: boolean;
  discoveryFirstStructuredResponseSeen?: boolean;
  updatedAt?: Timestamp;
};

export type PropertyCheckpointMetricsStatus =
  | "no_checkpoints"
  | "pending_analysis"
  | "partial"
  | "ready"
  | "stale";

export type PropertyCheckpointIssueRow = {
  severity: "critical" | "major" | "moderate" | "minor";
  description: string;
  checkpointId: string;
  checkpointName: string;
  createdAt: string;
};

// Property-level checkpoint analytics (written by backend metrics worker)
export type PropertyCheckpointMetrics = {
  version: number;
  updatedAt?: Timestamp;
  status?: PropertyCheckpointMetricsStatus;
  window?: {
    max_checkpoints?: number;
    checkpoints_considered: number;
    checkpoints_with_score?: number;
    trend_points: number;
  };
  overall?: {
    headline?: {
      value: number | null;
      source: "weighted_mean" | "latest_checkpoint" | null;
      latest_checkpoint_id: string | null;
      latest_checkpoint_score: number | null;
    } | null;
    /** @deprecated v1; use headline.value */
    latest_score?: number | null;
    trend: Array<{ t: string; score: number; checkpointId?: string }>;
  };
  issues?: {
    total_by_severity: {
      critical: number;
      major: number;
      moderate: number;
      minor: number;
    };
    total: number;
    recent?: PropertyCheckpointIssueRow[];
  };
  deterioration?: {
    rate_points_per_day: number | null;
    trend: "improving" | "stable" | "deteriorating" | "unknown";
  };
};
