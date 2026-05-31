/** Service branch search outcome persisted on `analysis.serviceResults`. */

export type ServiceSearchStatus = "failed" | "ok";

export function getServiceResultsFromAnalysis(
  analysis: unknown
): Record<string, unknown> | undefined {
  if (!analysis || typeof analysis !== "object") {
    return undefined;
  }
  const record = analysis as Record<string, unknown>;
  const service = record.serviceResults;
  return service && typeof service === "object"
    ? (service as Record<string, unknown>)
    : undefined;
}

export function serviceSearchFailed(
  service: Record<string, unknown> | undefined
): boolean {
  return (
    !!service &&
    String(service.searchStatus ?? "")
      .trim()
      .toLowerCase() === "failed"
  );
}

export function serviceSearchFailureMessage(
  service: Record<string, unknown> | undefined
): string {
  if (!serviceSearchFailed(service) || !service) {
    return "";
  }
  const msg =
    typeof service.searchError === "string" ? service.searchError.trim() : "";
  return msg || "Service provider search did not complete. Please try again.";
}

/** True when the Service accordion should render (providers or explicit failure). */
export function serviceSectionHasVisibleContent(
  service: Record<string, unknown> | undefined,
  providerCount: number
): boolean {
  return providerCount > 0 || serviceSearchFailed(service);
}
