/**
 * Extracts the title from a checkpoint agent response.
 * Checkpoint agents return responses in dual format: Markdown + JSON code block.
 * The JSON contains an analysis.title field that should be used to rename the session.
 * 
 * @param content The agent response content
 * @returns The title string if found, null otherwise
 */
export function extractCheckpointTitle(content: string): string | null {
  if (!content) return null;

  try {
    // Look for JSON code block in the response
    const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)```/);
    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);

    // Check for checkpoint-specific fields to confirm this is a checkpoint response
    const analysis = parsed.analysis || parsed;
    const hasCheckpointData = !!(
      analysis.checkpointSummary ||
      analysis.checkpointDetails
    );

    if (!hasCheckpointData) return null;

    // Extract title from analysis.title
    if (analysis.title && typeof analysis.title === 'string') {
      return analysis.title.trim();
    }

    return null;
  } catch (error) {
    // Failed to parse JSON or extract title
    return null;
  }
}
