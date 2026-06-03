"use server";

/**
 * Queue document extraction on the proxy (Pub/Sub → worker → Firestore).
 * Clients should listen on `users/{userId}/docs/{docId}` for completion.
 */

export interface QueueExtractDocInfoInput {
  docId: string;
  docUrl: string;
  contentType: string;
  userId: string;
}

export interface QueueExtractDocInfoResult {
  status: string;
  message?: string;
  docId: string;
  messageId?: string;
}

export async function queueExtractDocInfo(
  input: QueueExtractDocInfoInput,
  idToken: string,
): Promise<QueueExtractDocInfoResult> {
  if (!input.docId?.trim()) {
    throw new Error(
      "queueExtractDocInfo requires docId (Firestore users/{uid}/docs/{docId}).",
    );
  }
  const { apiUrls } = await import("@/lib/utils");
  const url = apiUrls.extractDocInfo();

  if (!url) {
    throw new Error("Extract doc info API URL not configured");
  }

  const { proxyFetchWithAuth } = await import("@/lib/correlation-id");
  const response = await proxyFetchWithAuth(url, async () => idToken, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const { planLimitMessageForErrorCode, parsePlanLimitErrorCode } =
      await import("@/lib/plan-limit-errors");
    const quotaMessage = planLimitMessageForErrorCode(
      parsePlanLimitErrorCode(errorBody),
    );
    if (quotaMessage) {
      throw new Error(quotaMessage);
    }
    throw new Error(
      `Failed to queue document analysis, status: ${response.status}, body: ${errorBody}`,
    );
  }

  return (await response.json()) as QueueExtractDocInfoResult;
}
