import type { PrimaryAgent } from '@homeapp/common/types';

/**
 * Checkpoint-related keywords that suggest the user wants checkpoint functionality
 */
const CHECKPOINT_KEYWORDS = [
  'checkpoint',
  'checkpoints',
  'before and after',
  'before/after',
  'compare',
  'comparison',
  'changed',
  'changes',
  'over time',
  'timeline',
  'condition over',
  'trend',
  'trends',
  'damage',
  'wear',
  'deterioration',
  'condition',
  'inspection',
  'progress',
  'history',
  'previous',
  'past',
  'when was',
  'what changed',
  'show me',
  'show all',
];

/**
 * Analysis-related keywords that suggest the user wants analysis/triage functionality
 */
const ANALYSIS_KEYWORDS = [
  'repair',
  'fix',
  'broken',
  'leak',
  'issue',
  'problem',
  'help',
  'diagnosis',
  'what is',
  'what\'s wrong',
  'how to',
  'how do',
  'service',
  'provider',
  'professional',
  'contractor',
  'cost',
  'price',
  'estimate',
  'diy',
  'coverage',
  'warranty',
  'insurance',
];

/**
 * Detects if a query suggests checkpoint functionality
 * @param query - User's query text
 * @returns true if query suggests checkpoint agent
 */
export function suggestsCheckpointAgent(query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Check for checkpoint-related keywords
  const hasCheckpointKeyword = CHECKPOINT_KEYWORDS.some((keyword) =>
    normalizedQuery.includes(keyword)
  );
  
  // Check for temporal/time-based queries (indicating comparison/trend analysis)
  const hasTimeIndicators = /(between|from|to|since|before|after|january|february|march|april|may|june|july|august|september|october|november|december|month|week|year|ago|last|first)/i.test(
    normalizedQuery
  );
  
  // Check for comparison patterns
  const hasComparisonPattern = /(vs|versus|compared to|compared with|difference|different|same|similar)/i.test(
    normalizedQuery
  );
  
  return hasCheckpointKeyword || (hasTimeIndicators && hasComparisonPattern);
}

/**
 * Detects if a query suggests analysis/triage functionality
 * @param query - User's query text
 * @returns true if query suggests analysis agent
 */
export function suggestsAnalysisAgent(query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Check for analysis-related keywords
  const hasAnalysisKeyword = ANALYSIS_KEYWORDS.some((keyword) =>
    normalizedQuery.includes(keyword)
  );
  
  return hasAnalysisKeyword;
}

/**
 * Suggests which primary agent to use based on query intent
 * @param query - User's query text
 * @param currentAgent - Currently selected agent
 * @returns Suggested agent or null if no suggestion
 */
export function suggestPrimaryAgent(
  query: string,
  currentAgent: PrimaryAgent
): PrimaryAgent | null {
  if (!query.trim()) return null;
  
  const suggestsCheckpoint = suggestsCheckpointAgent(query);
  const suggestsAnalysis = suggestsAnalysisAgent(query);
  
  // If query strongly suggests checkpoint but analysis is selected, suggest checkpoint
  if (suggestsCheckpoint && !suggestsAnalysis && currentAgent === 'analysis') {
    return 'checkpoint';
  }
  
  // If query strongly suggests analysis but checkpoint is selected, suggest analysis
  if (suggestsAnalysis && !suggestsCheckpoint && currentAgent === 'checkpoint') {
    return 'analysis';
  }
  
  // If both or neither, don't suggest a change
  return null;
}

