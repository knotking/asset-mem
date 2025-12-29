

import "regenerator-runtime/runtime";
import type { Timestamp } from 'firebase/firestore';

export type AgentStep = {
  name: string;
  status: 'transferredto' | 'executing' | 'completed' | 'failed';
};

export const ANALYSIS_OPTIONAL_AGENTS = ['coverage', 'diy', 'service', 'cost'] as const;

export type AnalysisOptionalAgent = (typeof ANALYSIS_OPTIONAL_AGENTS)[number];

export type PrimaryAgent = 'analysis' | 'checkpoint';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
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
    type: 'DEED' | 'INSURANCE_POLICY' | 'UTILITY_BILL' | 'INSPECTION_REPORT' | 'MORTGAGE_STATEMENT' | 'OTHER';
  }[];
  agentSteps?: AgentStep[];
};

export type StructuredResponseData = {
  analysis?: {
    title?: string;
    triageResult?: {
      diagnosis?: string;
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
      }
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
}

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
}

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
}

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
}

export type Document = {
  id: string;
  userId: string;
  propertyId: string;
  name:string;
  url: string;
  storagePath: string;
  createdAt: Timestamp;
  gsURI?: string;
  contentType?: string;
  summary?: string;
  documentType?: 'DEED' | 'INSURANCE_POLICY' | 'UTILITY_BILL' | 'INSPECTION_REPORT' | 'MORTGAGE_STATEMENT' | 'OTHER';
  propertyAddress?: string; // This is now redundant but we keep for migration/lookup if needed.
  keyEntities?: { name: string; value: string }[];
  status?: 'uploading' | 'analyzing' | 'complete' | 'failed';
}

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
}

export type LocationType = 'address' | 'location';

export type LocationCoordinates = {
  lat: number;
  lng: number;
};

export type LocationData = {
  locationType?: LocationType;
  locationCoordinates?: LocationCoordinates;
  locationRadius?: number; // 10-100 miles
};


export type Service = {
    id: string;
    userId: string;
    propertyId: string;
    name: string;
    status: 'pending' | 'completed' | 'cancelled';
    scheduledDate: Date;
    createdAt: Date;
}

// Checkpoint types - imported from common package for consistency across apps
export type {
  Checkpoint,
  CheckpointMedia,
  CheckpointAnalysis,
  VisualDiffAnalysis,
  ChangeRegion,
  CheckpointComparisonPreferences,
  UserPreferences,
  PropertyCheckpointMetrics,
} from '@homeapp/common/types';
    
export type Provider = {
  id: string;
  userId: string;
  propertyId: string;
  name: string;
  category: string;
  status: 'active' | 'inactive';
  rating: number;
  phone: string;
  email: string;
  specialties: string[];
  addedDate: Date;
  createdAt: Date;
}
