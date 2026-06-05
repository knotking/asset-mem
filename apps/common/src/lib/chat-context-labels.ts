export const ADD_CONTEXT_TITLE = "Add context";

export const PENDING_CHECKPOINT_LABEL = "Analyzing checkpoint…";
export const PENDING_DOCUMENT_UPLOAD_LABEL = "Uploading document…";
export const PENDING_DOCUMENT_ANALYZE_LABEL = "Analyzing document…";
export const PENDING_DOCUMENT_INDEX_LABEL = "Indexing for chat…";

export const ASK_WHEN_READY_LABEL = "Ask when ready";
export const ASK_WHEN_READY_HINT =
  "Your message will send automatically when processing finishes.";

export const CONTEXT_READY_EMPTY_CHECKPOINT =
  "Select or capture a checkpoint that has finished analyzing.";
export const CONTEXT_READY_EMPTY_DOCS =
  "Select or upload a document that has finished indexing.";

export const CONTEXT_SELECTION_CHECKPOINT_LIMIT = (max: number) =>
  `You can select up to ${max} checkpoints per message.`;

export const CONTEXT_SELECTION_DOCUMENT_LIMIT = (max: number) =>
  `You can select up to ${max} documents per message.`;

export const ADD_CONTEXT_TAB_TIMELINE = "Timeline";
export const ADD_CONTEXT_TAB_DOCUMENTS = "Documents";

/** Checkpoint mode: checkpoints required; docs optional but sent as contextDocURIs. */
export const ADD_CONTEXT_MODE_HINT_CHECKPOINT =
  "Requires at least one timeline checkpoint. Documents are optional extra context.";

export const ADD_CONTEXT_MODE_HINT_DOCS =
  "Requires at least one indexed document.";

export const ADD_CONTEXT_TIMELINE_DOCS_MODE_NOTE =
  "Captures save to your property timeline. Switch to Checkpoint mode to include them in chat.";

export const ADD_CONTEXT_SEARCH_PLACEHOLDER = "Search by name, location, or type…";

export const ADD_CONTEXT_SEARCH_PLACEHOLDER_TIMELINE =
  "Search checkpoints by name or location…";

export const ADD_CONTEXT_SEARCH_PLACEHOLDER_DOCUMENTS =
  "Search documents by name or type…";

export const ADD_CONTEXT_RECENT_LABEL = "Recent";

export const ADD_CONTEXT_ALL_CHECKPOINTS_LABEL = "All checkpoints";
export const ADD_CONTEXT_ALL_DOCUMENTS_LABEL = "All documents";
export const ADD_CONTEXT_SEARCH_RESULTS_LABEL = "Results";

export type AddContextLibraryTab = "timeline" | "documents";

export function getAddContextLibrarySectionLabel(
  tab: AddContextLibraryTab,
  hasSearch: boolean
): string {
  if (hasSearch) return ADD_CONTEXT_SEARCH_RESULTS_LABEL;
  return tab === "timeline"
    ? ADD_CONTEXT_ALL_CHECKPOINTS_LABEL
    : ADD_CONTEXT_ALL_DOCUMENTS_LABEL;
}

/** Section header before the main list when split from Recent or during search. */
export function shouldShowAddContextLibrarySectionHeader(
  hasSearch: boolean,
  hasRecentSection: boolean
): boolean {
  return hasSearch || hasRecentSection;
}

export type AddContextCaptureAction = "camera" | "gallery" | "video" | "upload";

export const ADD_CONTEXT_LAUNCHING_CAMERA = "Opening camera…";
export const ADD_CONTEXT_LAUNCHING_GALLERY = "Opening library…";
export const ADD_CONTEXT_LAUNCHING_VIDEO = "Opening recorder…";
export const ADD_CONTEXT_LAUNCHING_UPLOAD = "Opening files…";

export function isTimelineCaptureAction(action: AddContextCaptureAction): boolean {
  return action === "camera" || action === "gallery" || action === "video";
}

export function getAddContextLaunchingLabel(action: AddContextCaptureAction): string {
  switch (action) {
    case "camera":
      return ADD_CONTEXT_LAUNCHING_CAMERA;
    case "gallery":
      return ADD_CONTEXT_LAUNCHING_GALLERY;
    case "video":
      return ADD_CONTEXT_LAUNCHING_VIDEO;
    case "upload":
      return ADD_CONTEXT_LAUNCHING_UPLOAD;
  }
}

export const ADD_CONTEXT_SELECTED_SUMMARY = (
  checkpointCount: number,
  documentCount: number,
  maxCp: number,
  maxDoc: number
) => {
  const parts: string[] = [];
  if (checkpointCount > 0) parts.push(`${checkpointCount}/${maxCp} checkpoints`);
  if (documentCount > 0) parts.push(`${documentCount}/${maxDoc} documents`);
  return parts.length > 0 ? parts.join(" · ") : "Nothing selected";
};
