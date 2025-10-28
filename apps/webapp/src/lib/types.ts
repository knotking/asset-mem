

import "regenerator-runtime/runtime";
import type { Timestamp } from 'firebase/firestore';

export type AgentStep = {
  name: string;
  status: 'transferredto' | 'executing' | 'completed' | 'failed';
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
  };
  documents?: {
    name: string;
    type: 'DEED' | 'INSURANCE_POLICY' | 'UTILITY_BILL' | 'INSPECTION_REPORT' | 'MORTGAGE_STATEMENT' | 'OTHER';
  }[];
  agentSteps?: AgentStep[];
};

export type StructuredResponseData = {
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
  productRecommendationsResults?: {
      recommendedProducts?: RecommendedProducts;
  };
  costEstimationResults?: {
      costEstimates?: CostEstimates;
  };
}

export type Product = {
  product_name: string;
  vendor: string | null;
  url: string | null;
  item_price: string | null;
  rating: string | null;
  reviews: string | null;
  image_url: string | null;
  is_preferred_retailer: boolean;
};

export type RecommendedProducts = {
  DIY?: {
    products: Product[];
    description: string;
  };
  Service?: {
    products: Product[];
    description: string;
  };
  recommended_retailers?: string[];
  shopping_tips?: string[];
};

export type CostEstimates = {
  repair_type?: string;
  DIY?: {
    cost_range: string;
    includes: string[];
    savings: string;
    complexity: string;
  };
  Service?: {
    cost_range: string;
    includes: string[];
    benefits: string;
    complexity: string;
  };
  comparison?: {
    diy_savings?: string;
    professional_benefits?: string;
    considerations?: string;
  };
  recommendation?: {
    simple_repairs?: string;
    complex_repairs?: string;
    note?: string;
  };
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
    documents?: Document[];
    docIds?: string[]; // For client-side convenience
    docGsURIs?: string[]; // For client-side convenience
    servicesCount?: number;
    checksCount?: number;
}


export type Service = {
    id: string;
    userId: string;
    propertyId: string;
    name: string;
    status: 'pending' | 'completed' | 'cancelled';
    scheduledDate: Date;
    createdAt: Date;
}

export type CheckpointMedia = {
  id: string;
  url: string;
  type: 'image' | 'video';
  caption: string;
}

export type Checkpoint = {
  id: string;
  propertyId: string;
  userId: string;
  title: string;
  description: string;
  location: string;
  condition: 'good' | 'fair' | 'poor' | 'needs_attention';
  tags: string[];
  media: CheckpointMedia[];
  createdAt: Date;
}
    
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
