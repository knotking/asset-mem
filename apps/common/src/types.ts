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
