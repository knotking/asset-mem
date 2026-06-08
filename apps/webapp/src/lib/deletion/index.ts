/**
 * Deletion helpers — local copy for App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/deletion/
 */
export * from './types';
export * from './delete-collection';
export * from './api-client';
export * from './delete-session';
export * from './delete-property';
export * from './ux-copy';
export * from './resource-deletion-status';
export * from './mark-resource-deletion-failed';
export * from './deletion-error-message';
// delete-document, delete-checkpoint, storage-paths import firebase/storage — use subpath imports.
