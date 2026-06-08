import Constants from 'expo-constants';
import { buildDeletionApiUrls, type DeletionApiUrls } from '@homeapp/common/lib/deletion/api-client';

function proxyBaseFromExtra(): string {
  const extra = Constants.expoConfig?.extra || {};
  const agentSessionUrl = (extra.agentSessionUrl as string) || '';
  if (!agentSessionUrl) return '';
  return agentSessionUrl.replace(/\/agent-session\/?$/, '');
}

export function getMappDeletionApiUrls(): DeletionApiUrls | null {
  const base = proxyBaseFromExtra();
  if (!base) return null;
  return buildDeletionApiUrls(base);
}
