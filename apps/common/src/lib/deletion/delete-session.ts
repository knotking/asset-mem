import type { GetFirebaseIdToken } from '../correlation-id';
import type { Session } from '../../types';
import {
  deleteSessionViaProxy,
  deleteSessionsBatchViaProxy,
} from './api-client';
import type { DeletionResult } from './types';

export type DeleteSessionParams = {
  userId: string;
  session: Pick<Session, 'id' | 'agentSessionId'>;
  sessionDeleteUrl: string;
  getIdToken: GetFirebaseIdToken;
};

export async function deleteChatSession(params: DeleteSessionParams): Promise<DeletionResult> {
  return deleteSessionViaProxy({
    url: params.sessionDeleteUrl,
    getIdToken: params.getIdToken,
    userId: params.userId,
    sessionId: params.session.id,
  });
}

export async function deleteChatSessionsBatch(params: {
  userId: string;
  sessionIds: string[];
  sessionsBatchUrl: string;
  getIdToken: GetFirebaseIdToken;
}): Promise<DeletionResult> {
  return deleteSessionsBatchViaProxy({
    url: params.sessionsBatchUrl,
    getIdToken: params.getIdToken,
    userId: params.userId,
    sessionIds: params.sessionIds,
  });
}
