
'use server';

/**
 * @fileOverview An AI agent that extracts key information from a property document.
 * 
 * - extractDocInfo - A function that handles the document extraction process.
 * - ExtractDocInfoInput - The input type for the extractDocInfo function.
 * - ExtractDocInfoOutput - The return type for the extractDocInfo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractDocInfoInputSchema = z.object({
  docUrl: z.string().describe('The public URL of the document to be processed.'),
  contentType: z.string().describe('The MIME type of the document.'),
});
export type ExtractDocInfoInput = z.infer<typeof ExtractDocInfoInputSchema>;

const ExtractDocInfoOutputSchema = z.object({
  documentType: z.enum([
    'DEED', 'INSURANCE_POLICY', 'UTILITY_BILL', 
    'INSPECTION_REPORT', 'MORTGAGE_STATEMENT', 'OTHER'
  ]).describe('The classified type of the document.'),
  propertyAddress: z.string().describe('The full, normalized street address of the property mentioned in the document (e.g., "123 Main Street, Anytown, CA 12345"). Convert street abbreviations to their full names (St -> Street, Ave -> Avenue). If not found, return "N/A".'),
  keyEntities: z.array(z.object({
    name: z.string().describe('The name of the entity, e.g., "Policy Number", "Insurance Provider".'),
    value: z.string().describe('The value of the entity, e.g., "POL12345", "Allstate".')
  })).describe('A list of 2-3 key entities found in the document.'),
  summary: z.string().describe("A concise one-sentence summary of the document's purpose and content."),
});

export type ExtractDocInfoOutput = z.infer<typeof ExtractDocInfoOutputSchema>;

export async function extractDocInfo(input: ExtractDocInfoInput): Promise<ExtractDocInfoOutput> {
  return extractDocInfoFlow(input);
}

const extractDocInfoFlow = ai.defineFlow(
  {
    name: 'extractDocInfoFlow',
    inputSchema: ExtractDocInfoInputSchema,
    outputSchema: ExtractDocInfoOutputSchema,
  },
  async ({ docUrl, contentType }) => {
    
    const docPart = { media: { url: docUrl, contentType } };
    
    const prompt = `
        You are an expert real estate document analyst. Your task is to extract key information from the provided property document and return it in a structured format. 
        
        Analyze the document and provide the following:
        1. Classify the documentType.
        2. Extract the full propertyAddress. IMPORTANT: Normalize the address to a standard format. For example, convert "St" to "Street" and "Ave" to "Avenue".
        3. Identify 2-3 of the most important keyEntities (like a policy number, a loan amount, or an inspection date).
        4. Provide a single-sentence summary of the document.

        Document:
    `;

    const llmResponse = await ai.generate({
      prompt: [
        { text: prompt },
        docPart
      ],
      output: {
        schema: ExtractDocInfoOutputSchema,
      },
    });

    return llmResponse.output!;
  }
);
