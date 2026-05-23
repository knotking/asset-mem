import { apiUrls } from "./utils";
import { parseProxyErrorMessage } from "./auth-handoff-errors";

export type MobileWebHandoffConsumeResult = {
  customToken: string;
  returnPath: string;
};

export async function consumeMobileWebHandoff(
  code: string,
): Promise<MobileWebHandoffConsumeResult> {
  const res = await fetch(apiUrls.mobileWebHandoffConsume(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseProxyErrorMessage(text, res.status));
  }
  const data = JSON.parse(text) as MobileWebHandoffConsumeResult;
  if (!data.customToken || !data.returnPath) {
    throw new Error("Invalid handoff response");
  }
  return data;
}
