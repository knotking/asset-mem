
'use server';

/**
 * @fileOverview An AI agent that extracts key information from a property document.
 * 
 * - extractDocInfo - A function that handles the document extraction process.
 * - ExtractDocInfoInput - The input type for the extractDocInfo function.
 * - ExtractDocInfoOutput - The return type for the extractDocInfo function.
 * 
 * This implementation uses the backend API (similar to mapp) instead of Vercel AI SDK.
 */

export interface ExtractDocInfoInput {
  docUrl: string;
  contentType: string;
}

export interface ExtractDocInfoOutput {
  documentType: 'DEED' | 'INSURANCE_POLICY' | 'UTILITY_BILL' | 'INSPECTION_REPORT' | 'MORTGAGE_STATEMENT' | 'OTHER';
  propertyAddress: string;
  keyEntities: Array<{ name: string; value: string }>;
  summary: string;
}

/**
 * Extract document information using AI analysis via backend API
 * This matches the mapp implementation pattern
 */
export async function extractDocInfo(input: ExtractDocInfoInput): Promise<ExtractDocInfoOutput> {
  try {
    // Import apiUrls dynamically to avoid circular dependencies
    const { apiUrls } = await import('@/lib/utils');
    const url = apiUrls.extractDocInfo();
    
    if (!url) {
      throw new Error('Extract doc info API URL not configured');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to analyze document, status: ${response.status}, body: ${errorBody}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}
