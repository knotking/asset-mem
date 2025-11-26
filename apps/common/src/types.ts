import type { Timestamp } from 'firebase/firestore';

export const PROPERTY_TYPES = ['House', 'Apartment', 'Condo', 'Townhouse', 'Land', 'Other'] as const;

export type PropertyType = typeof PROPERTY_TYPES[number];

export type AgentStep = {
  name: string;
  status: 'transferredto' | 'executing' | 'completed' | 'failed';
};

export const ANALYSIS_OPTIONAL_AGENTS = ['coverage', 'diy', 'service', 'cost'] as const;

export type AnalysisOptionalAgent = (typeof ANALYSIS_OPTIONAL_AGENTS)[number];

export type Location = {
  latitude: number;
  longitude: number;
  radius: number;
};

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
    width?: number;
    height?: number;
  };
  agentSteps?: AgentStep[];
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

export type Product = {
  // legacy fields (kept for backward compatibility)
  product_name?: string;
  item_price?: string | null;
  image_url?: string | null;
  rating?: string | null;
  reviews?: string | null;
  // new structured fields
  vendor?: string | null;
  url?: string | null;
  description?: string | null;
  price?: string | null;
}

export type StructuredResponseData = {
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

  // New format (nested structure)
  analysis?: {
    title?: string;
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
      }
    };
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
  documentType?: 'DEED' | 'INSURANCE_POLICY' | 'UTILITY_BILL' | 'INSPECTION_REPORT' | 'MORTGAGE_STATEMENT' | 'OTHER';
  propertyAddress?: string;
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
  cityStateZip?: string;
  documents?: Document[];
  docIds?: string[];
  docGsURIs?: string[];
  docs?: number;
  services?: number;
  checks?: number;
  servicesCount?: number;
  checksCount?: number;
}
