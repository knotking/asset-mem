export const DELETION_CONFIRM_CANNOT_UNDO = 'This action cannot be undone.';

export const propertyRemovingLabel = (name: string) => `Removing "${name}"…`;

/** Inline label while a list item is being deleted (sessions, checkpoints). */
export const resourceDeletingLabel = 'Deleting…';

export const propertyRemovedToast = (name: string) => `"${name}" was removed.`;

export const propertyDeleteFailedTitle = 'Could not finish removing property';

export const propertyDeleteFailedBody = (name: string, error?: string) =>
  error
    ? `Couldn't finish removing "${name}". ${error}`
    : `Couldn't finish removing "${name}". You can retry from the property list.`;

export const savedProviderDeleteConfirm = (name?: string | null) =>
  `Remove "${name?.trim() || 'this provider'}" from saved providers? ${DELETION_CONFIRM_CANNOT_UNDO}`;

export const sessionDeleteConfirm = (name?: string | null) =>
  `This will permanently delete the chat session "${name?.trim() || 'this session'}" and all of its messages. ${DELETION_CONFIRM_CANNOT_UNDO}`;

export const documentDeleteConfirm = (name?: string | null) =>
  `Are you sure you want to delete "${name?.trim() || 'this document'}"? ${DELETION_CONFIRM_CANNOT_UNDO}`;

export const checkpointDeleteConfirm = (name?: string | null) =>
  `This will permanently delete "${name?.trim() || 'this checkpoint'}". ${DELETION_CONFIRM_CANNOT_UNDO}`;

export const checkpointBulkDeleteFailed = 'Failed to delete checkpoints. Please try again.';

export const sessionDeleteSuccess = 'Chat session deleted successfully.';

export const sessionDeleteFailed = 'Could not delete the chat session. Please try again.';

export const sessionsBulkDeleteSuccess = (count: number) =>
  `${count} chat session${count === 1 ? '' : 's'} deleted successfully.`;

export const documentDeleteFailed = 'Failed to delete document. Please try again.';

export const resourceDeletionFailedLabel = 'Delete failed';
