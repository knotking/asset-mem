import { Platform } from "react-native";

import {
  getStructuredAccordionDefaultValue as getStructuredAccordionDefaultValueCommon,
  type StructuredAccordionSection,
  type StructuredAccordionVisibility,
} from "@homeapp/common/lib/structured-accordion-defaults";

export type { StructuredAccordionSection, StructuredAccordionVisibility };

export function getStructuredAccordionDefaultValue(
  visibility: StructuredAccordionVisibility
): StructuredAccordionSection | undefined {
  const platform = Platform.OS === "android" ? "android" : "ios";
  return getStructuredAccordionDefaultValueCommon(visibility, platform);
}
