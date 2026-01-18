/**
 * Extracts the title from a checkpoint agent response.
 * Checkpoint agents return responses in dual format: Markdown + JSON code block.
 * The JSON contains an analysis.title field that should be used to rename the session.
 * 
 * @param content The agent response content
 * @returns The title string if found, null otherwise
 */
export function extractCheckpointTitle(content: string): string | null {
  if (!content) {
    console.log('[extractCheckpointTitle] No content provided');
    return null;
  }

  try {
    // Look for JSON code block in the response
    const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)```/);
    if (!jsonMatch) {
      console.log('[extractCheckpointTitle] No JSON code block found in response');
      return null;
    }

    const jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);

    // Check for checkpoint-specific fields to confirm this is a checkpoint response
    const analysis = parsed.analysis || parsed;
    const hasCheckpointData = !!(
      analysis.checkpointSummary ||
      analysis.checkpointDetails
    );

    if (!hasCheckpointData) {
      console.log('[extractCheckpointTitle] No checkpoint data found in JSON');
      return null;
    }

    // Extract title from analysis.title
    if (analysis.title && typeof analysis.title === 'string') {
      const title = analysis.title.trim();
      console.log('[extractCheckpointTitle] Successfully extracted title:', title);
      return title;
    }

    console.log('[extractCheckpointTitle] No title field found in analysis');
    return null;
  } catch (error) {
    // Failed to parse JSON or extract title
    console.error('[extractCheckpointTitle] Error parsing response:', error);
    return null;
  }
}
