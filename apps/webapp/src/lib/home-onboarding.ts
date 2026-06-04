/**
 * Mirrors `apps/common/src/lib/home-onboarding.ts` for Firebase App Hosting:
 * the webapp does not depend on `@homeapp/common`. Keep both files in sync.
 */

import { Timestamp } from "firebase/firestore";
import type { Property, UserPreferences } from "@/lib/types";

export type OnboardingStepId = "add_property" | "upload" | "checkpoint" | "first_chat";

/** Route/search param set when opening chat from the home onboarding checklist. */
export const ONBOARDING_CHAT_OPEN_PARAM = "fromOnboardingChecklist";

export type OnboardingStepState = {
  id: OnboardingStepId;
  done: boolean;
};

function propertyDocCount(property: Property): number {
  const withCounts = property as Property & { docs?: number };
  return withCounts.docs ?? property.documents?.length ?? 0;
}

function propertyCheckCount(property: Property): number {
  const withCounts = property as Property & { checks?: number };
  return withCounts.checks ?? property.checksCount ?? 0;
}

function createdAtMs(createdAt: Property["createdAt"]): number {
  if (!createdAt) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (createdAt instanceof Timestamp) {
    return createdAt.toMillis();
  }
  if (typeof createdAt === "object" && "toDate" in createdAt) {
    const maybeDate = (createdAt as { toDate?: () => Date }).toDate?.();
    if (maybeDate) {
      return maybeDate.getTime();
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Oldest property by createdAt — stable onboarding target when nothing is pinned. */
export function getOldestPropertyId(properties: Property[]): string | undefined {
  if (properties.length === 0) {
    return undefined;
  }
  let oldest = properties[0];
  let oldestMs = createdAtMs(oldest.createdAt);
  for (const property of properties) {
    const ms = createdAtMs(property.createdAt);
    if (ms < oldestMs) {
      oldest = property;
      oldestMs = ms;
    }
  }
  return oldest.id;
}

export function resolveOnboardingPropertyId(
  properties: Property[],
  preferences: UserPreferences | null | undefined
): string | undefined {
  const pinned = preferences?.onboardingPropertyId;
  if (pinned && properties.some((property) => property.id === pinned)) {
    return pinned;
  }
  return getOldestPropertyId(properties);
}

export function getOnboardingStepStates(
  properties: Property[],
  preferences: UserPreferences | null | undefined
): {
  propertyId: string | undefined;
  steps: OnboardingStepState[];
  allDone: boolean;
  completedCount: number;
  totalSteps: number;
} {
  const totalSteps = 4;
  const hasProperty = properties.length > 0;
  const propertyId = resolveOnboardingPropertyId(properties, preferences);
  const target = propertyId
    ? properties.find((property) => property.id === propertyId)
    : undefined;

  const steps: OnboardingStepState[] = [
    { id: "add_property", done: hasProperty },
    { id: "upload", done: !!target && propertyDocCount(target) > 0 },
    { id: "checkpoint", done: !!target && propertyCheckCount(target) > 0 },
    { id: "first_chat", done: !!preferences?.onboardingChatOpened },
  ];

  const completedCount = steps.filter((step) => step.done).length;
  const allDone = steps.every((step) => step.done);

  return { propertyId, steps, allDone, completedCount, totalSteps };
}

export function shouldHideOnboardingChecklist(
  _properties: Property[],
  preferences: UserPreferences | null | undefined
): boolean {
  return !!preferences?.onboardingChecklistDismissed;
}

export function isOnboardingStepDone(
  stepId: OnboardingStepId,
  properties: Property[],
  preferences: UserPreferences | null | undefined
): boolean {
  return getOnboardingStepStates(properties, preferences).steps.find(
    (step) => step.id === stepId
  )?.done ?? false;
}
