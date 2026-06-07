

import { cn } from "@/lib/utils";
import type { Message, ServiceProvider, StructuredResponseData, Product, DiyCostEstimatesSummary, SaveServiceProviderMeta, SuggestedAction } from "@/lib/types";
import {
  EXECUTIVE_SUMMARY_ACCORDION_TITLE,
  EXECUTIVE_SUMMARY_ACCORDION_VALUE,
  getSummaryAccordionPreview,
  summaryAccordionPreviewIsTruncated,
  getCostEstimateRecommendation,
  SUMMARY_ACCORDION_PLACEHOLDER_PREVIEW,
} from "@/lib/executive-summary-display";
import { getStructuredAccordionDefaultValue } from "@/lib/structured-accordion-defaults";
import { getSuggestedActionsFromContentJson } from "@/lib/suggested-actions";
import { useSavedServiceProviders } from "@/contexts/saved-service-providers-context";
import { buildServiceProviderDedupeKey } from "@/lib/saved-service-provider-dedupe";
import {
    flattenServiceProviderRawList,
    isDisplayableServiceProvider,
    isVertexGroundingRedirectUrl,
    stripVertexGroundingUrls,
} from "@/lib/service-providers";
import { ChatAvatar } from "./chat-avatar";
import Image from "next/image";
import { File, Map, Building, Home, ShieldCheck, ReceiptText, Search, FileKey, FileText, Clock, Lightbulb, Copy, Star, Users, Phone, Mail, CheckCircle, Info, Wrench, Youtube, ExternalLink, Stethoscope, TrendingUp, ShoppingCart, DollarSign, Sparkles, AlertTriangle, Heart, ListChecks, Maximize2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDebouncedThinkingStatus } from "@/hooks/use-debounced-thinking-status";
import { CheckpointAccordionBranchBadge } from "@/components/chat/checkpoint-accordion-branch-badge";
import {
  hasPostContentPipelineWork,
  resolveStructuredAnalysis,
  shouldShowDisplayTitleGradient,
  shouldShowSummaryAccordionPlaceholder,
} from "@/lib/checkpoint-branch-progress";

/** Literal Tailwind utilities (must live in a scanned component file for JIT). */
const DISPLAY_TITLE_GRADIENT_CLASS =
  "inline-block bg-gradient-to-r from-primary via-muted-foreground to-primary bg-[length:200%_auto] bg-clip-text text-transparent [-webkit-text-fill-color:transparent] animate-text-gradient display-title-gradient-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { markdownToWhatsapp, htmlToWhatsapp } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createLogger } from "@/lib/logger";
import { useAssistantLoadingUi } from "@/hooks/use-assistant-loading-ui";
import { resolveMessageContentParts } from "@/lib/message-content-parts";
import { splitMessageContextRefItems } from "@/lib/chat-message-context-refs";
import { MessageContextRefsDisplay } from "@/components/chat/message-context-refs-display";
import {
  assistantMessageHasDisplayableContent,
  getMessageDisplayParts,
} from "@/lib/message-display-parts";
import {
  AssistantBounceDots,
  AssistantWaveDots,
} from "@/components/chat/assistant-loading-indicators";
import { StructuredReportSheet } from "@/components/chat/structured-report-sheet";

const parseLog = createLogger("parse");

// Helper function to safely extract string from warranty/insurance info
const extractTextFromCoverageInfo = (info: any): string => {
    if (!info) return '';
    
    // If it's already a string, return it
    if (typeof info === 'string') {
        return info;
    }
    
    // If it's an object, try to extract meaningful text
    if (typeof info === 'object' && info !== null) {
        // Check for common text properties
        if (info.text) return String(info.text);
        if (info.content) return String(info.content);
        if (info.message) return String(info.message);
        if (info.description) return String(info.description);
        if (info.summary) return String(info.summary);
        
        // If it's an array, join the items
        if (Array.isArray(info)) {
            return info.map(item => 
                typeof item === 'string' ? item : JSON.stringify(item)
            ).join('\n');
        }
        
        // Otherwise, format as JSON for readability
        try {
            return JSON.stringify(info, null, 2);
        } catch {
            return String(info);
        }
    }
    
    // Fallback to string conversion
    return String(info);
};

function getDiyHireProfessionalRecommended(diy: unknown): boolean {
    if (!diy || typeof diy !== "object") return false;
    const o = diy as Record<string, unknown>;
    return o.hireProfessionalRecommended === true || o.hire_professional_recommended === true;
}

function getDiyCostEstimatesBlock(diy: unknown): DiyCostEstimatesSummary | null {
    if (!diy || typeof diy !== "object") return null;
    const raw = (diy as Record<string, unknown>).diyCostEstimates;
    if (!raw || typeof raw !== "object") return null;
    return raw as DiyCostEstimatesSummary;
}

function diyCostBlockHasContent(ce: DiyCostEstimatesSummary): boolean {
    if (ce.repair_type && String(ce.repair_type).trim()) return true;
    const d = ce.DIY;
    if (!d || typeof d !== "object") return false;
    return !!(
        (d.cost_range && String(d.cost_range).trim()) ||
        (Array.isArray(d.includes) && d.includes.length > 0) ||
        (d.savings && String(d.savings).trim()) ||
        (d.complexity && String(d.complexity).trim())
    );
}

type CostEstimatesDetail = NonNullable<
    NonNullable<StructuredResponseData["analysis"]>["costEstimationResults"]
>["costEstimates"];

function CostEstimateLabelRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
    return (
        <div className="mb-2 flex items-start gap-2">
            <span className="text-sm font-medium text-muted-foreground shrink-0">{label}</span>
            <span className={cn("flex-1 text-sm", valueClassName ?? "text-foreground")}>{value}</span>
        </div>
    );
}

function CostEstimatesAccordionBody({ costEstimates }: { costEstimates: CostEstimatesDetail }) {
    if (typeof costEstimates === "string") {
        return <p className="text-sm whitespace-pre-wrap break-words text-foreground">{costEstimates}</p>;
    }
    if (!costEstimates || typeof costEstimates !== "object") {
        return null;
    }

    const diy = costEstimates.DIY;
    const service = costEstimates.Service;
    const comparison = costEstimates.comparison;

    return (
        <div className="space-y-3 not-prose">
            {costEstimates.repair_type && (
                <div className="mb-2">
                    <h4 className="text-sm font-semibold text-purple-600">Repair Type</h4>
                    <p className="text-sm text-foreground">{String(costEstimates.repair_type)}</p>
                </div>
            )}

            {diy && (
                <div className="mb-3 rounded-lg border border-border bg-background p-3">
                    <h4 className="mb-2 text-sm font-semibold text-foreground">DIY Option</h4>
                    {diy.cost_range && (
                        <CostEstimateLabelRow
                            label="Cost Range:"
                            value={String(diy.cost_range)}
                            valueClassName="font-semibold text-purple-600"
                        />
                    )}
                    {diy.savings && <CostEstimateLabelRow label="Savings:" value={String(diy.savings)} />}
                    {diy.complexity && <CostEstimateLabelRow label="Complexity:" value={String(diy.complexity)} />}
                    {Array.isArray(diy.includes) && diy.includes.length > 0 && (
                        <div className="mt-2">
                            <p className="mb-1 text-sm font-medium text-muted-foreground">Includes:</p>
                            <ul className="space-y-1">
                                {diy.includes.map((item, idx) => (
                                    <li key={idx} className="flex gap-2 text-sm text-foreground">
                                        <span>•</span>
                                        <span className="flex-1">{String(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {service && (
                <div className="mb-3 rounded-lg border border-border bg-background p-3">
                    <h4 className="mb-2 text-sm font-semibold text-foreground">Professional Service</h4>
                    {service.cost_range && (
                        <CostEstimateLabelRow
                            label="Cost Range:"
                            value={String(service.cost_range)}
                            valueClassName="font-semibold text-purple-600"
                        />
                    )}
                    {service.benefits && <CostEstimateLabelRow label="Benefits:" value={String(service.benefits)} />}
                    {service.complexity && (
                        <CostEstimateLabelRow label="Complexity:" value={String(service.complexity)} />
                    )}
                    {Array.isArray(service.includes) && service.includes.length > 0 && (
                        <div className="mt-2">
                            <p className="mb-1 text-sm font-medium text-muted-foreground">Includes:</p>
                            <ul className="space-y-1">
                                {service.includes.map((item, idx) => (
                                    <li key={idx} className="flex gap-2 text-sm text-foreground">
                                        <span>•</span>
                                        <span className="flex-1">{String(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {comparison && (
                <div className="mt-3 rounded-lg bg-muted p-3">
                    <h4 className="mb-2 text-sm font-semibold text-foreground">Comparison & Considerations</h4>
                    {comparison.diy_savings && (
                        <p className="mb-1 flex gap-2 text-sm text-foreground">
                            <span>•</span>
                            <span className="flex-1">DIY Savings: {String(comparison.diy_savings)}</span>
                        </p>
                    )}
                    {comparison.professional_benefits && (
                        <p className="mb-1 flex gap-2 text-sm text-foreground">
                            <span>•</span>
                            <span className="flex-1">
                                Professional Benefits: {String(comparison.professional_benefits)}
                            </span>
                        </p>
                    )}
                    {comparison.considerations && (
                        <p className="mb-1 flex gap-2 text-sm text-foreground">
                            <span>•</span>
                            <span className="flex-1">Considerations: {String(comparison.considerations)}</span>
                        </p>
                    )}
                </div>
            )}

            {(() => {
                const recommendation = getCostEstimateRecommendation(costEstimates);
                if (!recommendation) return null;
                return (
                    <div className="mt-3 rounded-lg border border-border bg-background p-3">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">Recommendation</h4>
                        {recommendation.notes ? (
                            <p className="mb-2 text-sm text-foreground">{recommendation.notes}</p>
                        ) : null}
                        {recommendation.next_steps ? (
                            <p className="text-sm text-foreground">{recommendation.next_steps}</p>
                        ) : null}
                    </div>
                );
            })()}
        </div>
    );
}

const docTypeIcons: { [key: string]: React.ElementType } = {
  DEED: Home,
  INSURANCE_POLICY: ShieldCheck,
  UTILITY_BILL: ReceiptText,
  INSPECTION_REPORT: Search,
  MORTGAGE_STATEMENT: FileKey,
  OTHER: FileText,
};

const ServiceProviderCard = ({
  provider,
  saveMeta,
}: {
  provider: ServiceProvider;
  saveMeta?: SaveServiceProviderMeta;
}) => {
    const { toast } = useToast();
    const { isSaved, saveProvider, removeProvider, savedProviders } = useSavedServiceProviders();
    const [savePending, setSavePending] = React.useState(false);
    const saved = isSaved(provider);
    const savedRow = saved
      ? savedProviders.find(
          (row) => buildServiceProviderDedupeKey(row) === buildServiceProviderDedupeKey(provider)
        )
      : undefined;

    const handleToggleSave = async () => {
      if (savePending) return;
      setSavePending(true);
      try {
        if (saved && savedRow) {
          await removeProvider(savedRow.id);
          toast({ title: "Removed from saved providers" });
          return;
        }
        const result = await saveProvider(provider, saveMeta);
        if (result === "saved") {
          toast({ title: "Saved provider" });
        } else if (result === "already_saved") {
          toast({ title: "Already in saved providers" });
        } else {
          toast({ variant: "destructive", title: "Could not save provider" });
        }
      } catch {
        toast({ variant: "destructive", title: "Could not update saved providers" });
      } finally {
        setSavePending(false);
      }
    };

    const linkStr = typeof provider.link === 'string' ? provider.link : undefined;
    const websiteStr = typeof provider.website === 'string' ? provider.website : undefined;

    const normalizeUrl = (u?: string): string | undefined => {
        if (!u || typeof u !== 'string') return undefined;
        const trimmed = u.trim();
        if (trimmed === '' || isVertexGroundingRedirectUrl(trimmed)) return undefined;
        const withProto = (/^https?:\/\//i.test(trimmed)) ? trimmed : `https://${trimmed}`;
        try {
            const url = new URL(withProto);
            return url.toString();
        } catch {
            return undefined;
        }
    };

    const primaryLink = normalizeUrl(linkStr) || normalizeUrl(websiteStr) || undefined;
    const primaryLinkLabel = 'Website';

    const isPrimaryLinkValid = typeof primaryLink === 'string' && /^https?:\/\//i.test(primaryLink);
    const isDirectionsLinkValid =
        typeof provider.directions === 'string' &&
        !isVertexGroundingRedirectUrl(provider.directions) &&
        (provider.directions.startsWith('http://') || provider.directions.startsWith('https://'));

    // Helper function to check if a value is meaningful (not empty, null, undefined, or "N/A")
    const hasValue = (val: any): boolean => {
        if (!val) return false;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            return trimmed !== '' && 
                   trimmed.toLowerCase() !== 'n/a' && 
                   trimmed.toLowerCase() !== 'not available' &&
                   trimmed.toLowerCase() !== 'none' &&
                   trimmed.toLowerCase() !== 'null';
        }
        return true;
    };

    // Extract rating number if available
    const ratingValue = provider.ratings && typeof provider.ratings === 'string' 
        ? provider.ratings.split('/')[0].trim() 
        : null;
    const hasRating = hasValue(ratingValue) && ratingValue !== 'N/A' && ratingValue !== '0';
    const hasReviews = hasValue(provider.reviews);
    const distanceLabel = formatDistanceLabel(provider.distance_miles);
    const hasDistance = !!distanceLabel;
    const hasContact = hasValue(provider.contact_info);
    const hasLocation = hasValue(provider.location);
    const hasAdditionalInfo = hasValue(provider.additional_information) && 
                               provider.additional_information?.toLowerCase() !== 'no additional information available.';
    const hasSpecialties = hasValue(provider.specialties);

    // Show card if provider has a name - we'll only display fields that have data
    // This ensures we show all providers that come from the agent, and let the UI handle empty fields gracefully
    if (!provider.name) {
        return null;
    }

    return (
    <Card className="flex flex-col h-full w-full">
        <CardHeader>
            <CardTitle className="text-base flex justify-between items-start gap-2">
            <span className="line-clamp-2 flex-1 min-w-0">{provider.name}</span>
                <motion.div className="flex items-center gap-1 shrink-0">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={savePending}
                    onClick={handleToggleSave}
                    aria-label={saved ? "Remove from saved providers" : "Save provider"}
                >
                    <Heart
                        className={cn(
                            "h-4 w-4",
                            saved ? "fill-red-500 text-red-500" : "text-muted-foreground"
                        )}
                    />
                </Button>
                {provider.authorized === "True" && (
                    <Badge variant="outline" className="flex items-center gap-1 bg-blue-100 text-blue-800 border-blue-200 shrink-0">
                        <CheckCircle className="h-3 w-3" />
                          Authorized
                    </Badge>
                )}
                </motion.div>
            </CardTitle>
            {(hasRating || hasReviews || hasDistance) && (
                <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                    {hasRating && (
                        <div className="flex items-center gap-1 text-sm text-yellow-500">
                            <Star className="h-4 w-4 fill-current" />
                            <span>{ratingValue}</span>
                        </div>
                    )}
                    {hasDistance && (
                        <span className="text-muted-foreground text-xs">{distanceLabel}</span>
                    )}
                    {hasReviews && (
                        <span className="text-muted-foreground text-xs">
                            {formatReviewCountLabel(provider.reviews)}
                        </span>
                    )}
                </CardDescription>
            )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-3">
             {hasAdditionalInfo && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                    {provider.additional_information}
                </p>
             )}
            <div className="text-sm space-y-2">
                {hasContact && (
                    <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className='min-w-0'>{provider.contact_info}</span>
                    </div>
                )}
                {hasLocation && (
                    <div className="flex items-start gap-2 min-w-0">
                        <Map className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="line-clamp-1 min-w-0">{provider.location}</span>
                    </div>
                )}
            </div>
            {hasSpecialties && (
                <div className="space-y-1 pt-1 min-w-0">
                    <h4 className="text-xs font-semibold text-muted-foreground">Specialties</h4>
                    <p className="text-xs text-foreground break-words">{provider.specialties}</p>
                </div>
            )}
        </CardContent>
        {(isPrimaryLinkValid || isDirectionsLinkValid) && (
            <CardFooter className="flex gap-2 mt-auto pt-4">
                {isPrimaryLinkValid && primaryLink && <Button variant="outline" size="sm" asChild><a href={primaryLink} target="_blank" rel="noopener noreferrer">{primaryLinkLabel}</a></Button>}
                {isDirectionsLinkValid && provider.directions && <Button variant="default" size="sm" asChild><a href={provider.directions} target="_blank" rel="noopener noreferrer">Directions</a></Button>}
            </CardFooter>
        )}
    </Card>
)};

const PRODUCT_LINK_PLACEHOLDERS = new Set([
    'n/a',
    'na',
    'none',
    'null',
    'not available',
    '-',
    'tbd',
]);

function isProductLinkPlaceholder(raw: string): boolean {
    return PRODUCT_LINK_PLACEHOLDERS.has(raw.trim().toLowerCase());
}

/** Real http(s) product page only — ignores DIY placeholders like "N/A". */
function resolveProductPageUrl(
    storeUrl?: string | null,
    legacyUrl?: string | null
): string | undefined {
    const tryNormalize = (trimmed: string): string | undefined => {
        const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        try {
            return new URL(withProto).toString();
        } catch {
            return undefined;
        }
    };
    for (const candidate of [storeUrl, legacyUrl]) {
        if (typeof candidate !== 'string') continue;
        const trimmed = candidate.trim();
        if (!trimmed || isProductLinkPlaceholder(trimmed)) continue;
        const normalized = tryNormalize(trimmed);
        if (!normalized) continue;
        try {
            const u = new URL(normalized);
            if (u.hostname === 'n' && /^\/a\/?$/i.test(u.pathname)) continue;
            if (isProductLinkPlaceholder(u.hostname)) continue;
        } catch {
            continue;
        }
        return normalized;
    }
    return undefined;
}

/** e.g. ``746`` → ``746 reviews``; pass through if label already present. */
function formatReviewCountLabel(
    reviews: string | number | null | undefined
): string | null {
    if (reviews == null || reviews === '') return null;
    const text = String(reviews).trim();
    if (!text) return null;
    if (/review/i.test(text)) return text;
    return `${text} reviews`;
}

function parseDistanceMiles(raw: unknown): string | undefined {
    if (raw == null || raw === '') return undefined;
    if (typeof raw === 'number' && !Number.isNaN(raw)) return String(raw);
    const text = String(raw).trim();
    if (!text) return undefined;
    const mi = text.match(/^(\d+(?:\.\d+)?)\s*mi\b/i);
    if (mi) return mi[1];
    const n = Number.parseFloat(text);
    if (!Number.isNaN(n)) return String(n);
    return undefined;
}

/** e.g. ``4.5`` → ``4.5 mi``; pass through if ``mi`` already present. */
function formatDistanceLabel(
    miles: string | number | null | undefined
): string | null {
    const parsed = parseDistanceMiles(miles);
    if (parsed == null) return null;
    if (/mi\b/i.test(String(miles))) return String(miles).trim();
    return `${parsed} mi`;
}

const ProductCard = ({ product }: { product: Product }) => {
    // Use new fields first, fallback to legacy fields
    const itemName = product.item_name || product.product_name || product.description || 'Product';
    const imageSrc = product.image_url || null;
    const productUrl = resolveProductPageUrl(product.store_url, product.url);
    
    return (
        <Card className="flex flex-col h-full w-full">
        <CardHeader>
            <CardTitle className="text-base flex justify-between items-start">
                <span className="line-clamp-2">{itemName}</span>
            </CardTitle>
            {product.vendor && (
                <CardDescription className="flex items-center gap-2 pt-1">
                    <ShoppingCart className="h-4 w-4" />
                    <span>{product.vendor}</span>
                </CardDescription>
            )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-3">
            {imageSrc && (
                <div className="relative w-full h-32 rounded-md overflow-hidden">
                    <Image
                        src={imageSrc}
                        alt={itemName}
                        fill
                        className="object-cover"
                    />
                </div>
            )}
            <div className="text-sm space-y-2">
                {(product.price || product.item_price) && (
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary">{product.price || product.item_price}</span>
                    </div>
                )}
                {(product.rating || product.reviews) && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        {product.rating && (
                            <span className="flex items-center gap-1 text-yellow-500">
                                <Star className="h-4 w-4 fill-current" />
                                <span>{product.rating}</span>
                            </span>
                        )}
                        {product.reviews && (
                            <span className="text-xs text-muted-foreground">
                                {formatReviewCountLabel(product.reviews)}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </CardContent>
        <CardFooter className="flex gap-2 mt-auto pt-4">
            {productUrl ? (
                <Button variant="outline" size="sm" asChild>
                    <a href={productUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Product
                    </a>
                </Button>
            ) : null}
        </CardFooter>
    </Card>
    );
};

const getPreviewText = (value?: string, max = 240) => {
    if (!value) return undefined;
    const plain = value
        .replace(/[`*_>#]/g, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    if (plain.length <= max) return plain;
    return plain.slice(0, max).trim().replace(/[.,!?;:]?$/, '') + '…';
};

const StructuredResponse = ({
  data,
  summaryMarkdown,
  displayTitleInProgress = false,
  isTurnInFlight = false,
  accordionPipelineInProgress = false,
  summarySynthesisInProgress = false,
  saveMeta,
  layoutMode = "inline",
  showTitleCard = true,
}: {
  data: StructuredResponseData;
  summaryMarkdown?: string;
  displayTitleInProgress?: boolean;
  isTurnInFlight?: boolean;
  /** Collapse accordions while optional branches or synthesis are in flight (not client stream). */
  accordionPipelineInProgress?: boolean;
  summarySynthesisInProgress?: boolean;
  saveMeta?: SaveServiceProviderMeta;
  layoutMode?: "inline" | "sheet";
  showTitleCard?: boolean;
}) => {
    const isSheetLayout = layoutMode === "sheet";
    const [reportSheetOpen, setReportSheetOpen] = useState(false);
    const analysis = data.analysis || {} as NonNullable<StructuredResponseData['analysis']>;
    // Support both nested (analysis.*) and flat structures (top-level keys)
    const triage = analysis?.triageResult || (data as any)?.triageResult;
    const checkpointSummary = analysis?.checkpointSummary;
    const coverage = analysis?.coverageResult || (data as any)?.coverageResult;
    const diy = analysis?.diyResults || (data as any)?.diyResults;
    const service = analysis?.serviceResults || (data as any)?.serviceResults || {};
    const cost = analysis?.costEstimationResults || (data as any)?.costEstimationResults;
    const rawTitle = (typeof analysis?.title === 'string' && analysis.title.trim())
        ? analysis.title.trim()
        : (typeof (data as any)?.title === 'string' && (data as any).title.trim() ? (data as any).title.trim() : undefined);

    // Normalize and validate provider objects coming from various agents/APIs
    const normalizeProvider = (p: any): ServiceProvider | null => {
        if (!p || typeof p !== 'object') return null;
        const nameCandidate = p.name || p.business_name || p.businessName || p.title || p.company || p.provider || p.store || '';
        const name = typeof nameCandidate === 'string' ? nameCandidate : String(nameCandidate || '');
        if (!name.trim()) return null;

        const cleanUrl = (u: unknown): string | undefined => {
            if (typeof u !== 'string') return undefined;
            const t = u.trim();
            if (!t || isVertexGroundingRedirectUrl(t)) return undefined;
            return t;
        };
        const website = cleanUrl(p.website) || cleanUrl(p.url) || cleanUrl(p.link) || undefined;
        const link = cleanUrl(p.link) || cleanUrl(p.url) || cleanUrl(p.website) || undefined;
        const directions = cleanUrl(p.directions) || cleanUrl(p.directions_url) || cleanUrl(p.map_link) || undefined;
        const contact_info = p.contact_info || p.phone || p.phoneNumber || p.contact || p.contactInfo || undefined;
        const location = p.location || p.address || p.address_line || undefined;
        const ratings = p.ratings || p.rating || undefined;
        const reviews = p.reviews || p.review_count || p.reviewCount || undefined;
        const distanceRaw =
            p.distance_miles ?? p._distance_miles ?? p.distance ?? undefined;
        const specialties = p.specialties || p.services || undefined;
        const additionalRaw = p.additional_information || p.description || p.about;
        const additional_information =
            typeof additionalRaw === 'string'
                ? stripVertexGroundingUrls(additionalRaw) || undefined
                : undefined;
        const authorized = p.authorized || p.verified || undefined;

        return {
            name,
            website,
            link,
            directions,
            contact_info,
            location,
            ratings: ratings != null ? String(ratings) : undefined,
            reviews: reviews != null ? String(reviews) : undefined,
            distance_miles:
                distanceRaw != null && distanceRaw !== ''
                    ? parseDistanceMiles(distanceRaw)
                    : undefined,
            specialties: specialties != null ? String(specialties) : undefined,
            additional_information: additional_information != null ? String(additional_information) : undefined,
            authorized: authorized != null ? String(authorized) : undefined,
        } as ServiceProvider;
    };

    const providerHasValidData = (provider: unknown): boolean =>
        isDisplayableServiceProvider(provider);

    // Get all providers (before filtering) to check if service section should show
    // Handle both array format and potential string/object formats
    const getProvidersArray = (providers: any): ServiceProvider[] =>
        flattenServiceProviderRawList(providers) as ServiceProvider[];

    const allProvidersRaw = [
        // Keep legacy Yelp fallback for older stored responses.
        ...getProvidersArray(service?.localPros?.yelpAPIResults),
        ...getProvidersArray(service?.localPros?.serpAPIResults),
        ...getProvidersArray(service?.localPros?.googleSearchResults),
        ...getProvidersArray(service?.providers),
        ...getProvidersArray(service?.localProviders),
        ...getProvidersArray(service?.local_pros),
        ...getProvidersArray(service?.results),
        ...getProvidersArray(service?.nearbyProviders),
    ];
    
    // Filter providers to show only those with meaningful data
    const allProviders = (allProvidersRaw
        .filter(providerHasValidData)
        .map(normalizeProvider)
        .filter(Boolean) as ServiceProvider[])
        .slice(0, 10);

    const needsClarification = !!(triage?.needs_clarification === true);
    const hasClarificationQuestions = !!(needsClarification && Array.isArray(triage?.clarification_questions) && triage.clarification_questions.length > 0);
    const hasTriage = !!(triage?.diagnosis && typeof triage.diagnosis === 'string' && triage.diagnosis.trim() !== '');
    const hasCheckpointSummary = !!(checkpointSummary && (
        checkpointSummary.checkpointsAnalyzed || 
        (checkpointSummary.issuesDetected && checkpointSummary.issuesDetected.length > 0) ||
        checkpointSummary.overallCondition ||
        (checkpointSummary.locations && checkpointSummary.locations.length > 0)
    ));
    const hasCoverage = !needsClarification && !!(coverage && (coverage.warrantyInfo || coverage.insuranceInfo));
    const diyCostBlock = getDiyCostEstimatesBlock(diy);
    const hasDiyCostInDiy = !!(diyCostBlock && diyCostBlockHasContent(diyCostBlock));
    const hasDIY = !needsClarification && !!(diy && (
        getDiyHireProfessionalRecommended(diy) ||
        hasDiyCostInDiy ||
        diy.diySteps?.summary ||
        (diy.diySteps?.steps && diy.diySteps.steps.length > 0) ||
        (diy.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0) ||
        (diy.recommendedProducts?.products && diy.recommendedProducts.products.length > 0)
    ));
    const hasProviders = allProviders.length > 0;
    const serviceSearchFailedFlag =
        String((service as { searchStatus?: string })?.searchStatus ?? "")
            .trim()
            .toLowerCase() === "failed";
    const serviceFailureCopy =
        typeof (service as { searchError?: string })?.searchError === "string" &&
        (service as { searchError?: string }).searchError!.trim()
            ? (service as { searchError: string }).searchError.trim()
            : "Service provider search did not complete. Please try again.";
    const hasService = !needsClarification && (hasProviders || serviceSearchFailedFlag);
    const hasCostEstimates = !needsClarification && !!(cost && cost.costEstimates);
    const hasSummaryMarkdown = !!summaryMarkdown?.trim();
    const showSummaryAccordion =
      hasSummaryMarkdown ||
      (summarySynthesisInProgress && !hasSummaryMarkdown);

    const hasCheckpointDetails = Array.isArray((analysis as { checkpointDetails?: unknown })?.checkpointDetails)
      && ((analysis as { checkpointDetails: unknown[] }).checkpointDetails.length > 0);
    const insightsRecord = (analysis as { insights?: Record<string, unknown> })?.insights;
    const hasCheckpointInsights = !!insightsRecord
      && typeof insightsRecord === "object"
      && Object.keys(insightsRecord).length > 0;

    const accordionVisibility = useMemo(
      () => ({
        needsClarification,
        analysisInProgress: accordionPipelineInProgress,
        hasCheckpointSummary,
        hasCheckpointDetails,
        hasCheckpointInsights,
        hasCoverage,
        hasDIY,
        hasService,
        hasCostEstimates,
      }),
      [
        needsClarification,
        accordionPipelineInProgress,
        hasCheckpointSummary,
        hasCheckpointDetails,
        hasCheckpointInsights,
        hasCoverage,
        hasDIY,
        hasService,
        hasCostEstimates,
      ]
    );

    const accordionDefaultValue = useMemo(
      () => getStructuredAccordionDefaultValue(accordionVisibility, "web"),
      [accordionVisibility]
    );

    const [openSection, setOpenSection] = useState<string | undefined>(
      accordionDefaultValue
    );

    useEffect(() => {
      if (isSheetLayout) return;
      setOpenSection((current) =>
        current === undefined && accordionDefaultValue
          ? accordionDefaultValue
          : current
      );
    }, [accordionDefaultValue, isSheetLayout]);

    const summaryPreview = useMemo(() => {
      if (hasSummaryMarkdown) {
        return getSummaryAccordionPreview(summaryMarkdown!);
      }
      if (summarySynthesisInProgress) {
        return SUMMARY_ACCORDION_PLACEHOLDER_PREVIEW;
      }
      return "";
    }, [hasSummaryMarkdown, summaryMarkdown, summarySynthesisInProgress]);
    const summaryPreviewTruncated = useMemo(
      () =>
        hasSummaryMarkdown
          ? summaryAccordionPreviewIsTruncated(summaryMarkdown!, summaryPreview)
          : false,
      [hasSummaryMarkdown, summaryMarkdown, summaryPreview]
    );
    const summaryAccordionExpanded =
      isSheetLayout || openSection === EXECUTIVE_SUMMARY_ACCORDION_VALUE;

    const allExpandedSectionValues = useMemo(() => {
      const values: string[] = [];
      if (hasTriage || needsClarification) values.push("triage");
      if (hasCheckpointSummary) values.push("checkpoint-summary");
      if (hasCheckpointDetails) values.push("checkpoint-details");
      if (hasCheckpointInsights) values.push("checkpoint-insights");
      if (hasCoverage) values.push("coverage");
      if (hasDIY) values.push("diy");
      if (hasService) values.push("service");
      if (hasCostEstimates) values.push("cost-estimates");
      if (showSummaryAccordion) values.push(EXECUTIVE_SUMMARY_ACCORDION_VALUE);
      return values;
    }, [
      hasTriage,
      needsClarification,
      hasCheckpointSummary,
      hasCheckpointDetails,
      hasCheckpointInsights,
      hasCoverage,
      hasDIY,
      hasService,
      hasCostEstimates,
      showSummaryAccordion,
    ]);

    const noopMultipleAccordionChange = useCallback((_value: string[]) => {}, []);

    parseLog.debug('serviceRecommendations', {
            serviceExists: !!service,
            rawProvidersCount: allProvidersRaw.length,
            filteredProvidersCount: allProviders.length,
            hasProviders: hasProviders,
            hasServiceSection: hasService,
            serviceKeys: service ? Object.keys(service) : [],
            localProsExists: !!service?.localPros,
            localProsKeys: service?.localPros ? Object.keys(service.localPros) : [],
            serpAPIResults: service?.localPros?.serpAPIResults ? (Array.isArray(service.localPros.serpAPIResults) ? service.localPros.serpAPIResults.length : typeof service.localPros.serpAPIResults) : 'missing',
            firstProvider: allProvidersRaw.length > 0 ? allProvidersRaw[0] : null,
            fullServiceData: service
        });

    // Currency helper
    const toCurrency = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') {
            const stripped = value.replace(/[^0-9.\-]/g, '');
            if (stripped === '') return value;
            const num = Number(stripped);
            if (isNaN(num)) return value;
            return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }
        if (typeof value === 'number') {
            return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }
        return '';
    };

    // Service: render cost estimates
    const isPrimitive = (v: any) => v === null || ['string','number','boolean'].includes(typeof v);
    const renderPrimitive = (v: any) => {
        if (v === null || v === undefined) return <span className="text-muted-foreground">N/A</span>;
        if (typeof v === 'number') return <span>{toCurrency(v) || String(v)}</span>;
        if (typeof v === 'string') return <span>{v}</span>;
        if (typeof v === 'boolean') return <span>{v ? 'Yes' : 'No'}</span>;
        return <span>{String(v)}</span>;
    };

    const renderRecursiveDetails = (
        title: string,
        value: any,
        keyPath: string,
        /** Set when this AccordionItem is a direct child of a mapped Accordion list (React list keys). */
        listKey?: React.Key,
    ): React.ReactNode => {
        if (value === null || value === undefined) return null;
        // Known tables (array of objects) → simple table
        if (Array.isArray(value) && value.length > 0 && value.every(v => v && typeof v === 'object' && !Array.isArray(v))) {
            const headers = Array.from(new Set(value.flatMap((row: any) => Object.keys(row))));
            return (
                <AccordionItem key={listKey} value={`${keyPath}-table`} className="border rounded-lg">
                    <AccordionTrigger className="text-sm px-3 hover:no-underline">
                        <div className="flex items-center gap-2"><span className="font-semibold">{title}</span></div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-0 pb-3 px-3">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border rounded">
                                <thead>
                                    <tr className="bg-muted/40">
                                        {headers.map(h => (<th key={h} className="text-left p-2 capitalize">{h.split('_').join(' ')}</th>))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {value.map((row: any, idx: number) => (
                                        <tr key={idx} className="border-t">
                                            {headers.map(h => (
                                                <td key={h} className="p-2 align-top">
                                                    {isPrimitive(row[h]) ? renderPrimitive(row[h]) : <code className="text-xs">{JSON.stringify(row[h])}</code>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            );
        }

        // Array of primitives → list
        if (Array.isArray(value) && value.every(isPrimitive)) {
            return (
                <AccordionItem key={listKey} value={`${keyPath}-list`} className="border rounded-lg">
                    <AccordionTrigger className="text-sm px-3 hover:no-underline"><span className="font-semibold">{title}</span></AccordionTrigger>
                    <AccordionContent className="pt-0 pb-3 px-3">
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {value.map((v, i) => (<li key={i}>{renderPrimitive(v)}</li>))}
                        </ul>
                    </AccordionContent>
                </AccordionItem>
            );
        }

        // Object → nested accordion with key/value
        if (typeof value === 'object' && !Array.isArray(value)) {
            const entries = Object.entries(value as Record<string, any>);
            return (
                <AccordionItem key={listKey} value={`${keyPath}-obj`} className="border rounded-lg">
                    <AccordionTrigger className="text-sm px-3 hover:no-underline"><span className="font-semibold">{title}</span></AccordionTrigger>
                    <AccordionContent className="pt-0 pb-3 px-3">
                        <Accordion type="multiple" className="space-y-2">
                            {entries.map(([k, v]) => (
                                <div key={k}>
                                    {isPrimitive(v) ? (
                                        <div className="flex items-start justify-between py-1 text-sm">
                                            <span className="font-medium mr-3 capitalize">{k.split('_').join(' ')}</span>
                                            <span className="text-right">{renderPrimitive(v)}</span>
                                        </div>
                                    ) : (
                                        renderRecursiveDetails(k.split('_').join(' '), v, `${keyPath}-${k}`)
                                    )}
                                </div>
                            ))}
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
            );
        }

        // Primitive → simple row
        return (
            <AccordionItem key={listKey} value={`${keyPath}-val`} className="border rounded-lg">
                <AccordionTrigger className="text-sm px-3 hover:no-underline"><span className="font-semibold">{title}</span></AccordionTrigger>
                <AccordionContent className="pt-0 pb-3 px-3 text-sm">{renderPrimitive(value)}</AccordionContent>
            </AccordionItem>
        );
    };

    // Cost estimates removed from analysis output; related parsing/rendering omitted

    const diagnosisPreview = !needsClarification && typeof triage?.diagnosis === 'string'
        ? getPreviewText(triage.diagnosis)
        : undefined;
    const clarificationPreview = needsClarification
        ? getPreviewText(triage?.message || triage?.diagnosis)
        : undefined;
    const displayTitle = rawTitle || (needsClarification ? clarificationPreview : diagnosisPreview);
    const showTitleGradient =
      !isSheetLayout &&
      (isTurnInFlight || displayTitleInProgress || accordionPipelineInProgress);

    const sheetStructuredResponse = (
      <StructuredResponse
        layoutMode="sheet"
        showTitleCard={false}
        data={data}
        summaryMarkdown={summaryMarkdown}
        displayTitleInProgress={displayTitleInProgress}
        isTurnInFlight={isTurnInFlight}
        accordionPipelineInProgress={accordionPipelineInProgress}
        summarySynthesisInProgress={summarySynthesisInProgress}
        saveMeta={saveMeta}
      />
    );

    return (
        <div className="space-y-4">
            {!isSheetLayout && displayTitle ? (
              <StructuredReportSheet
                open={reportSheetOpen}
                onOpenChange={setReportSheetOpen}
                title={displayTitle}
              >
                {sheetStructuredResponse}
              </StructuredReportSheet>
            ) : null}
            {displayTitle && showTitleCard ? (
                <div className="rounded-lg border bg-muted/40 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 flex-1 text-base font-semibold sm:text-lg">
                          <span
                              className={cn(
                                  showTitleGradient ? DISPLAY_TITLE_GRADIENT_CLASS : "text-foreground",
                              )}
                          >
                              {displayTitle}
                          </span>
                      </h2>
                      {!isSheetLayout ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          aria-label="Open full report"
                          onClick={() => setReportSheetOpen(true)}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                </div>
            ) : null}
        <Accordion
          {...(isSheetLayout
            ? {
                type: "multiple" as const,
                value: allExpandedSectionValues,
                onValueChange: noopMultipleAccordionChange,
              }
            : {
                type: "single" as const,
                collapsible: true,
                value: openSection,
                onValueChange: setOpenSection,
              })}
          className="w-full space-y-2"
        >
            {(hasTriage || needsClarification) && (
                <AccordionItem value="triage" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Stethoscope className="h-5 w-5 text-blue-600" />
                            <span className="font-semibold">
                                {needsClarification ? "Clarification Needed" : "Triage Summary"}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0">
                        {needsClarification && hasClarificationQuestions ? (
                            <div className="space-y-4">
                                {triage.message && (
                                    <p className="text-sm text-muted-foreground mb-3">
                                        {triage.message}
                                    </p>
                                )}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Please provide more information:</h4>
                                    <ol className="list-decimal pl-6 space-y-2">
                                        {triage.clarification_questions.map((question: string, index: number) => (
                                            <li key={index} className="text-sm">
                                                {question}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        ) : hasTriage ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {String(triage!.diagnosis!)}
                            </ReactMarkdown>
                        ) : null}
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasCheckpointSummary && (
                <AccordionItem value="checkpoint-summary" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            <span className="font-semibold">Checkpoint Summary</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <div className="space-y-3">
                            {checkpointSummary?.checkpointsAnalyzed && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Checkpoints Analyzed:</span>
                                    <span className="text-sm font-semibold">{checkpointSummary.checkpointsAnalyzed}</span>
                                </div>
                            )}
                            {checkpointSummary?.queryType && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Query Type:</span>
                                    <Badge variant="outline" className="text-xs capitalize">
                                        {checkpointSummary.queryType}
                                    </Badge>
                                </div>
                            )}
                            {checkpointSummary?.locations && checkpointSummary.locations.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Locations:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {checkpointSummary.locations.map((location, idx) => (
                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                {location}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {checkpointSummary?.dateRange && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Date Range:</span>
                                    <span className="text-sm">{checkpointSummary.dateRange}</span>
                                </div>
                            )}
                            {checkpointSummary?.overallCondition && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Overall Condition:</span>
                                    <span className="text-sm">{checkpointSummary.overallCondition}</span>
                                </div>
                            )}
                            {checkpointSummary?.issuesDetected && checkpointSummary.issuesDetected.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-muted-foreground min-w-[140px]">Issues Detected:</span>
                                    <ul className="list-disc pl-5 space-y-1 flex-1">
                                        {checkpointSummary.issuesDetected.map((issue, idx) => (
                                            <li key={idx} className="text-sm">{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {analysis?.checkpointDetails && Array.isArray(analysis.checkpointDetails) && analysis.checkpointDetails.length > 0 && (
                <AccordionItem value="checkpoint-details" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Info className="h-5 w-5 text-blue-600" />
                            <span className="font-semibold">Checkpoint Details</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <Accordion type="multiple" className="space-y-2">
                            {analysis.checkpointDetails.map((checkpoint: any, idx: number) =>
                                renderRecursiveDetails(
                                    checkpoint.name || `Checkpoint ${idx + 1}`,
                                    checkpoint,
                                    `checkpoint-detail-${idx}`,
                                    `checkpoint-detail-${idx}`,
                                )
                            )}
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {analysis?.insights && typeof analysis.insights === 'object' && Object.keys(analysis.insights).length > 0 && (
                <AccordionItem value="checkpoint-insights" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 text-left">
                            <Lightbulb className="h-5 w-5 text-yellow-600" />
                            <span className="font-semibold">Insights & Recommendations</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <div className="space-y-3">
                            {analysis.insights.changes && (
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Changes Observed</h4>
                                    <p className="text-sm">{analysis.insights.changes}</p>
                                </div>
                            )}
                            {analysis.insights.patterns && (
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Patterns Identified</h4>
                                    <p className="text-sm">{analysis.insights.patterns}</p>
                                </div>
                            )}
                            {analysis.insights.recommendations && (
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Recommendations</h4>
                                    <p className="text-sm">{analysis.insights.recommendations}</p>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasCoverage && (
                <AccordionItem value="coverage" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex w-full items-center gap-2 text-left">
                            <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" />
                            <span className="flex-1 font-semibold">Coverage Analysis</span>
                            <CheckpointAccordionBranchBadge
                                branch="coverage"
                                analysis={analysis}
                                sectionReady={hasCoverage}
                            />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0">
                        {coverage?.warrantyInfo && (
                            <div className="space-y-2 mb-4">
                                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Warranty Information</h4>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {extractTextFromCoverageInfo(coverage.warrantyInfo)}
                                </ReactMarkdown>
                            </div>
                        )}
                        {coverage?.insuranceInfo && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Insurance Information</h4>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {extractTextFromCoverageInfo(coverage.insuranceInfo)}
                                </ReactMarkdown>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasDIY && (
                <AccordionItem value="diy" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex w-full items-center gap-2 text-left">
                            <Wrench className="h-5 w-5 shrink-0 text-orange-600" />
                            <span className="flex-1 font-semibold">DIY Recommendations</span>
                            <CheckpointAccordionBranchBadge
                                branch="diy"
                                analysis={analysis}
                                sectionReady={hasDIY}
                            />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0 space-y-4">
                        {getDiyHireProfessionalRecommended(diy) && (
                            <Alert variant="destructive" className="not-prose">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Professional help recommended</AlertTitle>
                                <AlertDescription>
                                    This repair may involve gas, electrical, structural, or other hazards. Consider hiring a licensed professional before attempting DIY work.
                                </AlertDescription>
                            </Alert>
                        )}
                        {diyCostBlock && diyCostBlockHasContent(diyCostBlock) && (
                            <div className="not-prose space-y-2 rounded-md border border-amber-200/90 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                                <h4 className="text-sm font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Estimated DIY cost
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    Indicative range from our repair library—not a quote. Verify with local pricing.
                                </p>
                                {diyCostBlock.repair_type && (
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">Repair type:</span>{" "}
                                        {String(diyCostBlock.repair_type)}
                                    </p>
                                )}
                                {diyCostBlock.DIY?.cost_range && (
                                    <p className="text-sm">
                                        <span className="font-medium">Typical range:</span>{" "}
                                        {String(diyCostBlock.DIY.cost_range)}
                                    </p>
                                )}
                                {Array.isArray(diyCostBlock.DIY?.includes) && diyCostBlock.DIY!.includes!.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium">Includes</p>
                                        <ul className="list-disc pl-5 text-sm space-y-1">
                                            {diyCostBlock.DIY!.includes!.map((it: string, i: number) => (
                                                <li key={i}>{it}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {diyCostBlock.DIY?.savings && (
                                    <p className="text-sm">
                                        <span className="font-medium">Savings:</span> {String(diyCostBlock.DIY.savings)}
                                    </p>
                                )}
                                {diyCostBlock.DIY?.complexity && (
                                    <p className="text-sm">
                                        <span className="font-medium">Complexity:</span>{" "}
                                        {String(diyCostBlock.DIY.complexity)}
                                    </p>
                                )}
                            </div>
                        )}
                        {diy?.diySteps?.summary && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">Summary</h4>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {String(diy.diySteps.summary)}
                                </ReactMarkdown>
                            </div>
                        )}
                        {diy?.diySteps?.steps && diy.diySteps.steps.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">Step-by-Step Instructions</h4>
                                <ol className="list-decimal pl-6 space-y-2">
                                    {diy.diySteps.steps.map((s: any, idx: number) => (
                                        <li key={idx} className="text-sm">{s.description}</li>
                                    ))}
                                </ol>
                            </div>
                        )}
                        
                        {diy?.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                    <Youtube className="h-4 w-4" /> Video Tutorials
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {diy.youtubeSearch.videos.map((v: any, i: number) => {
                                        const id = getYouTube_VideoId(v.url);
                                        return (
                                            <div key={i} className="space-y-2">
                                                {id ? (
                                                    <iframe
                                                        src={`https://www.youtube.com/embed/${id}`}
                                                        frameBorder="0"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        title={v.title || `YouTube video ${i+1}`}
                                                        className="w-full max-w-full aspect-video rounded-md border"
                                                    />
                                                ) : (
                                                    <a 
                                                        href={v.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-blue-600 dark:text-blue-400 underline break-words block"
                                                    >
                                                        {v.title || v.url}
                                                    </a>
                                                )}
                                                {v.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-3">{v.description}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {(() => {
                            // Handle both formats:
                            // 1. Direct format: recommendedProducts.products (extracted by diy agent)
                            // 2. Category format: recommendedProducts.DIY.products (direct from shopping agent)
                            let products: Product[] = [];
                            if (diy?.recommendedProducts?.products && Array.isArray(diy.recommendedProducts.products)) {
                                products = diy.recommendedProducts.products;
                            } else if (diy?.recommendedProducts?.DIY?.products && Array.isArray(diy.recommendedProducts.DIY.products)) {
                                products = diy.recommendedProducts.DIY.products;
                            } else if (diy?.recommendedProducts && typeof diy.recommendedProducts === 'object') {
                                // Try to find any category with products
                                const categoryKeys = Object.keys(diy.recommendedProducts);
                                for (const key of categoryKeys) {
                                    const category = (diy.recommendedProducts as any)[key];
                                    if (category?.products && Array.isArray(category.products)) {
                                        products = category.products;
                                        break;
                                    }
                                }
                            }
                            
                            return products.length > 0 ? (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" /> Recommended Products
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {products.map((product: Product, index: number) => (
                                            <ProductCard key={index} product={product} />
                                        ))}
                                    </div>
                                </div>
                            ) : null;
                        })()}
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasService && (
                <AccordionItem value="service" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex w-full items-center gap-2 text-left">
                            <TrendingUp className="h-5 w-5 shrink-0 text-purple-600" />
                            <span className="flex-1 font-semibold">Service Recommendations</span>
                            <CheckpointAccordionBranchBadge
                                branch="service"
                                analysis={analysis}
                                sectionReady={hasService}
                            />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0 space-y-4">
                        {/* Show local pros section - always show if service data exists */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                <Users className="h-4 w-4" /> Local Service Providers
                            </h4>
                            {allProviders.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {allProviders.map((provider, index) => (
                                        <ServiceProviderCard key={index} provider={provider} saveMeta={saveMeta} />
                                    ))}
                                </div>
                            ) : serviceSearchFailedFlag ? (
                                <p className="text-sm text-muted-foreground">
                                    {serviceFailureCopy}
                                </p>
                            ) : hasProviders ? (
                                <p className="text-sm text-muted-foreground italic">
                                    Service providers were found but need additional processing to display full details.
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    No service providers found for this location. Try searching with a specific address or area.
                                </p>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            )}
            
            {hasCostEstimates && (
                <AccordionItem value="cost-estimates" className="border rounded-lg">
                    <AccordionTrigger className="text-sm sm:text-base px-4 hover:no-underline">
                        <div className="flex w-full items-center gap-2 text-left">
                            <DollarSign className="h-5 w-5 shrink-0 text-purple-600" />
                            <span className="flex-1 font-semibold">Cost Estimates</span>
                            <CheckpointAccordionBranchBadge
                                branch="cost"
                                analysis={analysis}
                                sectionReady={hasCostEstimates}
                            />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0">
                        <CostEstimatesAccordionBody costEstimates={cost.costEstimates} />
                    </AccordionContent>
                </AccordionItem>
            )}

            {showSummaryAccordion && (
                <AccordionItem value={EXECUTIVE_SUMMARY_ACCORDION_VALUE} className="border rounded-lg">
                    <AccordionTrigger className="items-start px-4 py-3 text-sm hover:no-underline sm:text-base">
                        <div className="min-w-0 flex-1 pr-2 text-left">
                            <div className="flex items-center gap-2">
                                <ListChecks className="h-5 w-5 shrink-0 text-emerald-600" />
                                <span className="font-semibold text-foreground">
                                    {EXECUTIVE_SUMMARY_ACCORDION_TITLE}
                                </span>
                            </div>
                            {summaryPreview && !summaryAccordionExpanded ? (
                                <p className="mt-1 line-clamp-2 text-sm font-normal text-muted-foreground">
                                    {summaryPreview}
                                </p>
                            ) : null}
                            {summaryPreviewTruncated && !summaryAccordionExpanded ? (
                                <span className="mt-1 block text-xs font-normal text-muted-foreground/80">
                                    Show full summary
                                </span>
                            ) : null}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none break-words px-4 pb-4 pt-0">
                        {hasSummaryMarkdown ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryMarkdown!}</ReactMarkdown>
                        ) : (
                          <p className="text-sm text-muted-foreground animate-pulse">
                            {SUMMARY_ACCORDION_PLACEHOLDER_PREVIEW}
                          </p>
                        )}
                    </AccordionContent>
                </AccordionItem>
            )}
        </Accordion>
        </div>
    );
};


const getYouTube_VideoId = (url: string) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0];
    }
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      if (urlObj.pathname === '/watch') {
        return urlObj.searchParams.get('v');
      }
      if (urlObj.pathname.startsWith('/embed/')) {
        return urlObj.pathname.split('/')[2].split('?')[0];
      }
      if (urlObj.pathname.startsWith('/shorts/')) {
        return urlObj.pathname.split('/shorts/')[1].split('?')[0];
      }
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
  } catch (e) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
  }
};

const isGoogleMapsDirectionsUrl = (url: string) => {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes('google.') && urlObj.pathname.startsWith('/maps/dir/');
    } catch (e) {
        return false;
    }
}

const extractText = (node: any): string => {
  if (!node) return '';
  if (node.type === 'text') {
    return node.value || '';
  }
  if (Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
};

const findChild = (node: any, test: (node: any) => boolean): any => {
  if (!node || !node.children) return null;
  for (const child of node.children) {
    if (typeof child !== 'object' || child === null) continue;
    if (test(child)) return child;
    const found = findChild(child, test);
    if (found) return found;
  }
  return null;
};

const isYoutubeListItem = (node: any): boolean => {
  if (!node || node.tagName !== 'li') {
    return false;
  }
  const link = findChild(node, n => n.tagName === 'a' && n.properties && !!getYouTube_VideoId(n.properties.href));
  if (link) return true;

  const codeBlock = findChild(node, n => n.tagName === 'code');
  if (codeBlock) {
    const codeContent = extractText(codeBlock);
    if (getYouTube_VideoId(codeContent)) return true;
  }
  
  return false;
};

const markdownRenderers: any = {
  code({node, inline, className, children, ...props}: any) {
      if (inline) {
          const codeContent = String(children).trim();
          const videoId = getYouTube_VideoId(codeContent);
          if (videoId) {
              const parent = (node as any).parent;
              const isStandalone = parent && parent.type === 'element' && parent.tagName === 'p' && parent.children.length === 1;
              if (isStandalone) {
                return (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Embedded YouTube video"
                      className="w-full max-w-full aspect-video rounded-md my-2"
                    ></iframe>
                );
              }
          }
      }
      return <code className={className} {...props}>{children}</code>;
  },
  ul: ({ node, ...props }: any) => {
     if (!node) return <ul {...props} />;
     const isYouTubeList = Array.isArray(node.children) && node.children.some(isYoutubeListItem);

     if (isYouTubeList) {
         return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{props.children}</div>
     }
     return <ul {...props} />
  },
  li: ({ node, ...props }: any) => {
     if (!node) return <li {...props} />;
     
     const linkNode = findChild(node, (n: any) => n.tagName === 'a' && n.properties);
     const codeNode = findChild(node, (n: any) => n.tagName === 'code');
     
     let videoId: string | null = null;
     let urlToExclude = '';
     
     if (linkNode) {
        videoId = getYouTube_VideoId(linkNode.properties.href);
        urlToExclude = linkNode.properties.href;
     } else if (codeNode) {
        const codeContent = extractText(codeNode);
        videoId = getYouTube_VideoId(codeContent);
        urlToExclude = codeContent;
     }

     if (videoId) {
        const title = extractText(node)
          .replace(urlToExclude, '')
          .replace(/\[\]/g,'')
          .replace(/:/,'')
          .trim();
        
        return (
          <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Embedded YouTube video"
          className="w-full aspect-video rounded-md my-2"
          ></iframe>
         );
     }
     return <li {...props} />
  },
  p: ({ node, ...props }: any) => {
    if (!node) return <p {...props} />;
    const linkNode = findChild(node, (n: any) => n.tagName === 'a' && n.properties);
    if (!linkNode) return <p {...props} className="break-words" />;
    const videoId = getYouTube_VideoId(linkNode.properties.href);

    if (videoId && node.children.length > 0) {
       const title = extractText(node).replace(linkNode.properties.href, '').replace(/\[\]/g,'').trim();
       
       return (
        <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Embedded YouTube video"
        className="w-full max-w-full aspect-video rounded-md my-2"
        ></iframe>
       );
    }
    return <p {...props} className="break-words" />;
},
a: ({node, ...props}: any) => {
  if (!node) return <a {...props} />;
  const href = props.href || '';
  if (isGoogleMapsDirectionsUrl(href)) {
    try {
        const text = extractText(node);
        const url = new URL(href);
        const destination = url.searchParams.get('daddr');
        
        // This is the implementation for "Your Location" as the starting point
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=Your+Location&destination=${encodeURIComponent(destination || '')}`;

        return (
            <Button asChild variant="outline" size="sm" className="not-prose my-2">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                    <Map className="mr-2 h-4 w-4" />
                    {text.trim().startsWith('http') ? 'View Directions' : text}
                </a>
            </Button>
        )
    } catch(e) {
      // Fallback for invalid URL
    }
  }

  const videoId = getYouTube_VideoId(href);
  
  const parent = (node as any).parent;
  const isStandalone = parent && parent.tagName === 'p' && parent.children.length === 1;

   if (videoId && isStandalone) {
     return (
        <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded YouTube video"
            className="w-full max-w-full aspect-video rounded-md my-2"
        ></iframe>
     )
  }
  if (videoId) return null;

  return <a {...props} target="_blank" rel="noopener noreferrer" className="break-all">{props.children}</a>;
}
}


type Props = {
  message: Message;
  /** True while this assistant turn is still streaming on the client. */
  isTurnInFlight?: boolean;
  context?: 'property' | null;
  priorAssistantTurnCount?: number;
  hideRepeatedContextRefs?: boolean;
  onSuggestedAction?: (action: SuggestedAction) => void;
  isSendDisabled?: boolean;
};

const stripTextTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

function AssistantProgressStrip({
  header,
  detail,
  useProxyWaveIndicator = false,
}: {
  header: string;
  detail?: string | null;
  useProxyWaveIndicator?: boolean;
}) {
  const textKey = `${header}\u0000${detail ?? ""}`;
  return (
    <motion.div
      layout
      className="flex items-start gap-2 rounded-lg border bg-background/50 px-4 py-3 text-sm shadow-sm"
    >
      <div className="mt-0.5 shrink-0">
        {useProxyWaveIndicator ? (
          <AssistantWaveDots />
        ) : (
          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        {header ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={textKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={stripTextTransition}
              className="flex flex-col min-w-0"
            >
              <span className={DISPLAY_TITLE_GRADIENT_CLASS}>
                {header}
              </span>
              {detail ? (
                <span className="text-xs text-muted-foreground">{detail}</span>
              ) : null}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
    </motion.div>
  );
}

const ChatMessageComponent = ({
  message,
  isTurnInFlight = false,
  context,
  priorAssistantTurnCount = 0,
  hideRepeatedContextRefs = false,
  onSuggestedAction,
  isSendDisabled = false,
}: Props) => {
  const isUser = message.role === "user";
  const { markdown: messageMarkdown, contentJson: messageContentJson } =
    resolveMessageContentParts(message);
  const [isMediaLoaded, setIsMediaLoaded] = React.useState(false);
  const { toast } = useToast();
  
  const bubbleRef = React.useRef<HTMLDivElement>(null);

  const handleCopy = useCallback((event: React.ClipboardEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      event.preventDefault();
      const selectedHtml = selection.getRangeAt(0).cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(selectedHtml);
      const whatsappText = htmlToWhatsapp(tempDiv.innerHTML);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(whatsappText).then(() => {
          toast({ title: "Selection copied!" });
        }).catch(() => {
          toast({ variant: "destructive", title: "Copy failed" });
        });
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = whatsappText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          toast({ title: "Selection copied!" });
        } catch {
          toast({ variant: "destructive", title: "Copy failed" });
        }
        document.body.removeChild(textArea);
      }
    }
  }, [toast]);

  const displayParts = useMemo(
    () => getMessageDisplayParts(message),
    [message, messageMarkdown, messageContentJson]
  );

  const suggestedActions = useMemo(
    () => getSuggestedActionsFromContentJson(messageContentJson),
    [messageContentJson]
  );

  const hasDisplayableContent = useMemo(() => {
    if (isUser) return !!messageMarkdown?.trim();
    return assistantMessageHasDisplayableContent(displayParts);
  }, [isUser, displayParts, messageMarkdown]);

  const structuredAnalysis = useMemo(
    () => resolveStructuredAnalysis(messageContentJson),
    [messageContentJson]
  );
  const summarySynthesisInProgress = useMemo(
    () =>
      shouldShowSummaryAccordionPlaceholder(
        structuredAnalysis,
        message.agentSteps
      ),
    [structuredAnalysis, message.agentSteps]
  );
  const postContentPipelineInProgress = useMemo(
    () =>
      hasPostContentPipelineWork(structuredAnalysis, message.agentSteps),
    [structuredAnalysis, message.agentSteps]
  );

  const loadingUi = useAssistantLoadingUi({
    messageId: message.id,
    role: message.role,
    agentLifecycle: message.agentLifecycle,
    agentStepCount: message.agentSteps?.length ?? 0,
    hasDisplayableContent,
    isActiveLoading: isTurnInFlight && !isUser,
    priorAssistantTurnCount,
  });
  const {
    showTypingIndicator: showLoadingIndicator,
    showLifecycleStrip,
    showThinkingStrip,
    showStatusStrip,
    lifecycleHeader,
    useProxyWaveIndicator,
    typingIndicatorVariant,
  } = loadingUi;
  const thinkingStatus = useDebouncedThinkingStatus(
    showThinkingStrip ? message.agentSteps : null,
    {
      messageContentJson,
    },
  );
  const thinkingHeader = showLifecycleStrip
    ? lifecycleHeader
    : thinkingStatus.header;
  const thinkingPreview = showLifecycleStrip
    ? null
    : thinkingStatus.preview;
  const fileData = message.file;

  const handleCopyClick = () => {
    const whatsappFormattedText = markdownToWhatsapp(messageMarkdown);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(whatsappFormattedText).then(() => {
        toast({
          title: "Message copied!",
        });
      }, (err) => {
        toast({
          variant: "destructive",
          title: "Copy failed",
          description: "Could not copy message to clipboard.",
        });
      });
    } else {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = whatsappFormattedText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({ title: "Message copied!" });
      } catch {
        toast({
          variant: "destructive",
          title: "Copy failed",
          description: "Could not copy message to clipboard.",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const renderDocumentList = () => {
    if (!message.documents || message.documents.length === 0) return null;

    return (
        <div className="space-y-2 mt-2 not-prose">
            <p className="text-xs font-semibold text-muted-foreground">Context Documents:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.documents.map((doc, index) => {
                    const Icon = docTypeIcons[doc.type] || FileText;
                    return (
                        <div key={index} className="flex items-center gap-2 bg-background/50 p-2 rounded-md border text-xs">
                            <Icon className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate text-foreground" title={doc.name}>{doc.name}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
  }

  const renderContextRefs = () => {
    const refs = message.contextRefs;
    if (!refs) return null;
    const { visible, hiddenCount } = splitMessageContextRefItems(refs);
    if (visible.length === 0 && hiddenCount === 0) return null;

    return (
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {visible.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-2 py-1"
          >
            {item.kind === "checkpoint" ? (
              <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span className="max-w-28 truncate text-xs">{item.name}</span>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1">
            <span className="text-xs font-medium text-muted-foreground">+{hiddenCount} more</span>
          </div>
        ) : null}
      </div>
    );
  };

  const renderFilePreview = () => {
    if (!fileData) return null;

    const isImage = fileData.type.startsWith("image/");
    const isVideo = fileData.type.startsWith("video/");

    if (isImage) {
      return (
        <div className="relative h-[200px] w-[200px] max-w-xs">
          {!isMediaLoaded && (
             <div className="w-full h-full rounded-md space-y-2 p-2 bg-white flex flex-col justify-center">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[70%]" />
             </div>
          )}
          <Image
            src={fileData.url}
            alt={fileData.name}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            onLoad={() => setIsMediaLoaded(true)}
            className={cn(
              "rounded-md object-cover transition-opacity duration-500",
              "absolute inset-0",
              isMediaLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      );
    }
    
    if (isVideo) {
      return (
         <div className="relative w-full max-w-full">
          {!isMediaLoaded && (
             <div className="w-full aspect-video rounded-md space-y-2 p-2 bg-white flex flex-col justify-center">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-full" />
             </div>
          )}
          <video
            src={fileData.url}
            controls
            onLoadedData={() => setIsMediaLoaded(true)}
            className={cn("w-full rounded-md transition-opacity duration-500", isMediaLoaded ? "opacity-100" : "opacity-0")}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    
    if (isUser) {
        return (
          <div className="flex flex-row items-center justify-start gap-4 rounded-lg bg-secondary/80 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-secondary/20">
                <File className="h-8 w-8 shrink-0 text-secondary-foreground" />
            </div>
            <span className="text-sm font-medium break-all text-secondary-foreground">{fileData.name}</span>
          </div>
        )
    }

    return (
      <div className="relative w-48 h-48">
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 rounded-md border bg-background/50 text-foreground">
          <File className="h-8 w-8" />
          <span className="text-xs font-medium text-center break-all text-white">{fileData.name}</span>
        </div>
      </div>
    );
  };
  
  const bubbleStyle = !isUser ? { borderRadius: '18px 18px 18px 6px' } : {};
  const isMediaOnly =
    (fileData?.type.startsWith("image/") || fileData?.type.startsWith("video/")) &&
    !messageMarkdown;

  const effectiveStructuredData = displayParts.structuredData;

  const displayTitleAnalysisInProgress = useMemo(() => {
    if (isUser) return false;
    return shouldShowDisplayTitleGradient({
      structured: messageContentJson,
      steps: message.agentSteps,
      isTurnInFlight,
    });
  }, [isUser, messageContentJson, message.agentSteps, isTurnInFlight]);

  const isUserSplitContent =
    isUser && !showStatusStrip && !showLoadingIndicator && !effectiveStructuredData;

  const messageTimeLabel = useMemo(() => {
    if (!isUser && (showStatusStrip || showLoadingIndicator)) {
      return null;
    }
    if (!message.createdAt) return null;
    const date =
      message.createdAt instanceof Date
        ? message.createdAt
        : typeof message.createdAt === "object" &&
            message.createdAt !== null &&
            "toDate" in message.createdAt &&
            typeof message.createdAt.toDate === "function"
          ? message.createdAt.toDate()
          : null;
    if (!date) return null;
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }, [message.createdAt, isUser, showStatusStrip, showLoadingIndicator]);

  const renderUserMessageBody = () => (
    <div className="flex w-full max-w-full flex-col items-end gap-1.5">
      {message.contextRefs ? (
        <MessageContextRefsDisplay
          refs={message.contextRefs}
          hideRepeated={hideRepeatedContextRefs}
        />
      ) : null}
      {renderFilePreview()}
      {messageMarkdown ? (
        <div className="w-fit max-w-full rounded-lg bg-secondary px-4 py-2.5 text-secondary-foreground shadow-sm">
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <p className="m-0 whitespace-pre-wrap break-words text-secondary-foreground">
              {messageMarkdown}
            </p>
            {renderDocumentList()}
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderAssistantMessageBody = () => (
    <>
      {renderContextRefs()}
      {renderFilePreview()}
      {messageMarkdown ? (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownRenderers}>
            {messageMarkdown}
          </ReactMarkdown>
          {renderDocumentList()}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        { "justify-end": isUser },
      )}
    >
      <div className="hidden sm:block">
        {!isUser && <ChatAvatar message={message} context={context} />}
      </div>
      <div className={cn(
          "flex flex-col max-w-full sm:max-w-[calc(100%-4rem)] group relative",
          effectiveStructuredData
            ? "w-full md:w-5/6 lg:w-4/5"
            : isUserSplitContent
              ? "w-full"
              : "w-fit",
          isUser && "items-end"
      )} ref={bubbleRef} onCopy={handleCopy}>
          <div
            style={bubbleStyle}
            className={cn(
              "max-w-full shadow-sm flex flex-col",
              "animate-message-in",
              { "self-end": isUser },
              {
                "rounded-lg": isUser && !isUserSplitContent,
                "bg-muted border":
                  !isUser && !showStatusStrip && !showLoadingIndicator && !effectiveStructuredData,
                "bg-transparent border-0 shadow-none":
                  isUserSplitContent ||
                  showStatusStrip ||
                  showLoadingIndicator ||
                  effectiveStructuredData
              },
              !isUserSplitContent &&
                (isUser && messageMarkdown) &&
                "bg-secondary text-secondary-foreground",
              !isUserSplitContent && fileData && messageMarkdown ? "gap-2" : "",
              isUserSplitContent
                ? "p-0"
                : isMediaOnly
                  ? "bg-transparent p-0"
                  : fileData
                    ? "p-2"
                    : (showLoadingIndicator || showStatusStrip) &&
                        !hasDisplayableContent
                      ? "p-0"
                      : effectiveStructuredData
                        ? ""
                        : "px-4 py-2.5"
            )}
          >
            {!isUser &&
              hasDisplayableContent &&
              !showLoadingIndicator &&
              !effectiveStructuredData &&
              !!messageMarkdown.trim() && (
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleCopyClick}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy message</span>
                </Button>
            )}
            {showStatusStrip ? (
              <AssistantProgressStrip
                header={thinkingHeader}
                detail={thinkingPreview}
                useProxyWaveIndicator={showLifecycleStrip && useProxyWaveIndicator}
              />
            ) : showLoadingIndicator ? (
               <div className="flex items-center justify-start py-3">
                {typingIndicatorVariant === "wave" ? (
                  <AssistantWaveDots />
                ) : (
                  <AssistantBounceDots />
                )}
               </div>
            ) : effectiveStructuredData ? (
                <motion.div layout className="flex w-full flex-col gap-3">
                  <StructuredResponse
                    data={effectiveStructuredData}
                    summaryMarkdown={displayParts.summaryMarkdown}
                    displayTitleInProgress={displayTitleAnalysisInProgress}
                    isTurnInFlight={isTurnInFlight}
                    accordionPipelineInProgress={postContentPipelineInProgress}
                    summarySynthesisInProgress={summarySynthesisInProgress}
                    saveMeta={{
                      source: 'chat',
                      messageId: message.id,
                    }}
                  />
                </motion.div>
            ) : isUserSplitContent ? (
                renderUserMessageBody()
            ) : (
                renderAssistantMessageBody()
            )}
          </div>
          {!isUser &&
          !showLoadingIndicator &&
          !isTurnInFlight &&
          suggestedActions.length > 0 &&
          onSuggestedAction ? (
            <div className="relative z-10 mt-2 flex w-full flex-wrap gap-2">
              {suggestedActions.map((action) => (
                <Button
                  key={`${message.id}-${action.label}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal px-3 py-2 text-left text-sm"
                  disabled={isSendDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSuggestedAction(action);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
          {messageTimeLabel ? (
            <p className={cn("mt-1 text-xs text-muted-foreground", isUser && "text-right")}>
              {messageTimeLabel}
            </p>
          ) : null}
        </div>
      {isUser && (
        <div className="hidden sm:block">
          <ChatAvatar message={message} />
        </div>
      )}
    </div>
  );
}

export const ChatMessage = React.memo(ChatMessageComponent);
