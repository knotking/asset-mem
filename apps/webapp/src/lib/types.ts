import "regenerator-runtime/runtime";
import type { Timestamp } from "firebase/firestore";

export type AgentStep = {
  name: string;
  status: "transferredto" | "executing" | "completed" | "failed";
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

export type PrimaryAgent = "analysis" | "checkpoint" | "docs";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Timestamp | Date;
  followUpQuestions?: string[];
  file?: {
    name: string;
    type: string;
    url: string;
    gsURI?: string;
  };
  documents?: {
    name: string;
    type:
      | "DEED"
      | "INSURANCE_POLICY"
      | "UTILITY_BILL"
      | "INSPECTION_REPORT"
      | "MORTGAGE_STATEMENT"
      | "OTHER";
  }[];
  agentSteps?: AgentStep[];
};

export type StructuredResponseData = {
  analysis?: {
    title?: string;
    triageResult?: {
      diagnosis?: string;
    };
    checkpointSummary?: {
      checkpointsAnalyzed?: number;
      issuesDetected?: string[];
      overallCondition?: string;
      locations?: string[];
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
      diySteps?: {
        summary?: string;
        steps?: Array<{ stepNumber: number; description: string }>;
      };
      youtubeSearch?: {
        videos?: Array<{ title: string; url: string; description?: string }>;
      };
      recommendedProducts?: {
        products?: Product[];
        DIY?: {
          products?: Product[];
          description?: string;
        };
        Professional?: {
          products?: Product[];
          description?: string;
        };
        [key: string]: any; // Allow other category keys
      };
    };
    serviceResults?: {
      costEstimates?: string;
      localPros?: {
        serpAPIResults?: ServiceProvider[];
        yelpAPIResults?: ServiceProvider[];
        googleSearchResults?: ServiceProvider[];
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
  };
  title?: string;
};

export type Product = {
  // Primary fields (from shopping_agent)
  item_name?: string | null;
  image_url?: string | null;
  vendor?: string | null;
  reviews?: string | null;
  store_url?: string | null;
  // Legacy fields (kept for backward compatibility)
  product_name?: string | null;
  url?: string | null; // Maps to store_url
  item_price?: string | null;
  rating?: string | null;
  description?: string | null;
  price?: string | null;
};

export type ServiceProvider = {
  name: string;
  contact_info: string;
  location: string;
  reviews: string;
  ratings: string;
  directions: string | null;
  website: string | null;
  authorized: string;
  additional_information: string;
  specialties?: string;
  link?: string;
};

export type FileAttachment = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  downloadURL: string | null;
  error: string | null;
  storagePath: string;
};

export type Session = {
  id: string;
  name: string;
  createdAt: Timestamp;
  agentSessionId?: string;
  propertyId?: string | null;
  messageCount?: number;
  lastMessageAt?: Timestamp;
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
  propertyAddress?: string; // This is now redundant but we keep for migration/lookup if needed.
  keyEntities?: { name: string; value: string }[];
  status?: "uploading" | "analyzing" | "complete" | "failed";
};

export type Property = {
  id: string;
  userId: string;
  name: string;
  address: string;
  createdAt: Timestamp;
  propertyType?: string;
  propertySubType?: string;
  documents?: Document[];
  docIds?: string[]; // For client-side convenience
  docGsURIs?: string[]; // For client-side convenience
  servicesCount?: number;
  checksCount?: number;
};

export type LocationType = "address" | "location";

export type LocationCoordinates = {
  lat: number;
  lng: number;
};

export type LocationData = {
  locationType?: LocationType;
  locationCoordinates?: LocationCoordinates;
  locationRadius?: number; // 5-100 miles
};

export type Service = {
  id: string;
  userId: string;
  propertyId: string;
  name: string;
  status: "pending" | "completed" | "cancelled";
  scheduledDate: Date;
  createdAt: Date;
};

// Checkpoint types - copied from @homeapp/common/types for Firebase App Hosting compatibility
export type Checkpoint = {
  id: string;
  userId: string;
  propertyId: string;
  name: string; // e.g., "Monthly Inspection - Jan 2025"
  description?: string;
  createdAt: Timestamp;
  capturedAt?: Timestamp; // When the media was captured (vs when uploaded)
  media: CheckpointMedia[];
  location?: string; // e.g., "Kitchen", "Living Room", "Exterior" (user-provided or auto-detected)
  detectedAsset?: string; // Auto-detected asset name from AI (e.g., "Kitchen", "Refrigerator", "Car")
  assetConfidence?: number; // 0-1 confidence score for asset detection
  assetFeatures?: string[]; // Key features that identify the asset (e.g., ["stove", "sink"] for kitchen, ["engine", "wheels"] for car)
  areaDescription?: string; // Detailed description of the detected area/asset
  tags?: string[]; // e.g., ["monthly", "winter", "pre-storm"]
  analysisStatus?: "pending" | "processing" | "completed" | "failed";
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
  semanticChanges: string[]; // Gemini-generated descriptions
  heatmapUrl?: string; // URL to the generated overlay image
  regions: ChangeRegion[]; // Bounding boxes from Gemini
  similarityScore: number; // 0-1 score
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

export type CheckpointComparisonPreferences = {
  enabled: boolean; // Master switch for automatic comparison
  maxAgeDays: number; // Maximum age of previous checkpoint to compare with (default: 180)
  minAssetConfidence: number; // Minimum asset detection confidence to perform comparison (default: 0.3)
};

export type UserPreferences = {
  checkpointComparison?: CheckpointComparisonPreferences;
  updatedAt?: Timestamp;
};

// Property-level checkpoint analytics (written by backend aggregator for mobile consumption)
export type PropertyCheckpointMetrics = {
  version: number;
  updatedAt?: Timestamp;
  window?: {
    checkpoints_considered: number;
    trend_points: number;
  };
  overall?: {
    latest_score: number | null;
    trend: Array<{ t: string; score: number }>;
  };
  issues?: {
    total_by_severity: {
      critical: number;
      major: number;
      moderate: number;
      minor: number;
    };
    total: number;
  };
  deterioration?: {
    rate_points_per_day: number | null;
    trend: "improving" | "stable" | "deteriorating" | "unknown";
  };
};

export type Provider = {
  id: string;
  userId: string;
  propertyId: string;
  name: string;
  category: string;
  status: "active" | "inactive";
  rating: number;
  phone: string;
  email: string;
  specialties: string[];
  addedDate: Date;
  createdAt: Date;
};
