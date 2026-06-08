import { buildDeletionApiUrls, type DeletionApiUrls } from '@homeapp/common/lib/deletion/api-client';
import { apiUrls } from '@/lib/utils';

export function getWebDeletionApiUrls(): DeletionApiUrls {
  const base = apiUrls.agentSession().replace(/\/agent-session\/?$/, '');
  return buildDeletionApiUrls(base);
}
