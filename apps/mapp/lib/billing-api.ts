import { proxyFetchWithAuth } from '@homeapp/common/lib/correlation-id';
import { getExpoExtra } from '@/lib/expo-extra';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('billing-api');

function billingIosVerifyUrl(): string {
  return String(getExpoExtra().billingIosVerifyUrl ?? '').trim();
}

function billingIosRestoreUrl(): string {
  return String(getExpoExtra().billingIosRestoreUrl ?? '').trim();
}

async function parseProxyError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {
    // ignore
  }
  return `Request failed (${response.status})`;
}

export async function verifyIosTransaction(transactionId: string): Promise<void> {
  const url = billingIosVerifyUrl();
  if (!url) {
    throw new Error('iOS billing verify URL is not configured for this build.');
  }
  const response = await proxyFetchWithAuth(
    url,
    getFirebaseIdTokenForProxy,
    {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    },
  );
  if (!response.ok) {
    const message = await parseProxyError(response);
    log.warn('verifyIosTransaction.failed', { status: response.status, message });
    throw new Error(message);
  }
}

export async function restoreIosTransactions(transactionIds: string[]): Promise<void> {
  const url = billingIosRestoreUrl();
  if (!url) {
    throw new Error('iOS billing restore URL is not configured for this build.');
  }
  const ids = transactionIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new Error('No transactions to restore.');
  }
  const response = await proxyFetchWithAuth(
    url,
    getFirebaseIdTokenForProxy,
    {
      method: 'POST',
      body: JSON.stringify({ transactionIds: ids }),
    },
  );
  if (!response.ok) {
    const message = await parseProxyError(response);
    log.warn('restoreIosTransactions.failed', { status: response.status, message });
    throw new Error(message);
  }
}
