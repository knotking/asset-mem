export interface Document {
  id: string;
  gsURI: string;
  keyEntities: { name: string; value: string }[];
  name: string;
  propertyAddress: string;
  propertyId: string;
  status: string;
  storagePath: string;
  summary: string;
  url: string;
  userId: string;
}

export interface Property {
  id: string;
  address: string;
  cityStateZip: string;
  docs: number;
  services: number;
  checks: number;
  name: string;
  propertyType: string;
  createdAt: any;
  userId: string;
  documents: Document[];
}
