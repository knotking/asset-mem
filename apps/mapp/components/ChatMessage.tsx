import React, { useMemo, useCallback, useState } from 'react';
import { View, Linking, Pressable, Share, Modal, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Bot,
  FileText,
  ShieldCheck,
  Stethoscope,
  Wrench,
  Users,
  Phone,
  Map,
  Star,
  CheckCircle,
  Copy,
  AlertCircle,
  Share2,
  DollarSign,
  Sparkles,
  Info,
  Lightbulb,
  AlertTriangle,
  Heart,
} from 'lucide-react-native';
import { useSavedServiceProviders } from '@homeapp/common/contexts/saved-service-providers-context';
import { buildServiceProviderDedupeKey } from '@homeapp/common/lib/saved-service-provider-dedupe';
import type { SaveServiceProviderMeta } from '@homeapp/common/types';
import type {
  Message,
  StructuredResponseData,
  ServiceProvider,
  Product,
  DiyCostEstimatesSummary,
} from '@homeapp/common/types';
import {
  flattenServiceProviderRawList,
  isDisplayableServiceProvider,
  isVertexGroundingRedirectUrl,
  stripVertexGroundingUrls,
} from '@homeapp/common/lib/service-providers';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import Markdown from 'react-native-markdown-display';
import { useMarkdownStyles, markdownRules } from '@/lib/markdown-styles';
import { markdownToWhatsapp } from '@/lib/utils';
import TypingIndicator from './TypingIndicator';
import { AgentStatus } from './AgentStatus';
import { MediaDetailModal } from './MediaDetailModal';
import { CheckpointAccordionBranchBadge } from './CheckpointAccordionBranchBadge';
import { createLogger } from '@/lib/logger';

const chatLog = createLogger('chat');

interface ChatMessageProps {
  message: Message;
  sessionId?: string;
}

// Helper functions moved outside components
const hasValue = (val: any): boolean => {
  if (!val) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return (
      trimmed !== '' &&
      trimmed.toLowerCase() !== 'n/a' &&
      trimmed.toLowerCase() !== 'not available' &&
      trimmed.toLowerCase() !== 'none' &&
      trimmed.toLowerCase() !== 'null'
    );
  }
  return true;
};

function getDiyHireProfessionalRecommended(diy: unknown): boolean {
  if (!diy || typeof diy !== 'object') return false;
  const o = diy as Record<string, unknown>;
  return o.hireProfessionalRecommended === true || o.hire_professional_recommended === true;
}

function getDiyCostEstimatesBlock(diy: unknown): DiyCostEstimatesSummary | null {
  if (!diy || typeof diy !== 'object') return null;
  const raw = (diy as Record<string, unknown>).diyCostEstimates;
  if (!raw || typeof raw !== 'object') return null;
  return raw as DiyCostEstimatesSummary;
}

function diyCostBlockHasContent(ce: DiyCostEstimatesSummary): boolean {
  if (ce.repair_type && String(ce.repair_type).trim()) return true;
  const d = ce.DIY;
  if (!d || typeof d !== 'object') return false;
  return !!(
    (d.cost_range && String(d.cost_range).trim()) ||
    (Array.isArray(d.includes) && d.includes.length > 0) ||
    (d.savings && String(d.savings).trim()) ||
    (d.complexity && String(d.complexity).trim())
  );
}

const normalizeProvider = (p: any): ServiceProvider | null => {
  if (!p || typeof p !== 'object') return null;
  const nameCandidate =
    p.name ||
    p.business_name ||
    p.businessName ||
    p.title ||
    p.company ||
    p.provider ||
    p.store ||
    '';
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
  const directions =
    cleanUrl(p.directions) || cleanUrl(p.directions_url) || cleanUrl(p.map_link) || undefined;
  const contact_info =
    p.contact_info || p.phone || p.phoneNumber || p.contact || p.contactInfo || undefined;
  const location = p.location || p.address || p.address_line || undefined;
  const ratings = p.ratings || p.rating || undefined;
  const reviews = p.reviews || p.review_count || p.reviewCount || undefined;
  const distanceRaw = p.distance_miles ?? p._distance_miles ?? p.distance ?? undefined;
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
    ratings: ratings != null ? String(ratings) : '',
    reviews: reviews != null ? String(reviews) : '',
    distance_miles:
      distanceRaw != null && distanceRaw !== '' ? parseDistanceMiles(distanceRaw) : undefined,
    specialties: specialties != null ? String(specialties) : undefined,
    additional_information: additional_information != null ? String(additional_information) : '',
    authorized: authorized != null ? String(authorized) : '',
  } as ServiceProvider;
};

const providerHasValidData = (provider: unknown): boolean => isDisplayableServiceProvider(provider);

const getProvidersArray = (providers: any): ServiceProvider[] =>
  flattenServiceProviderRawList(providers) as ServiceProvider[];

const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const normalizeUrl = (u?: string): string | undefined => {
  if (!u || typeof u !== 'string') return undefined;
  const trimmed = u.trim();
  if (trimmed === '' || isVertexGroundingRedirectUrl(trimmed)) return undefined;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    return url.toString();
  } catch {
    return undefined;
  }
};

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
  for (const candidate of [storeUrl, legacyUrl]) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed || isProductLinkPlaceholder(trimmed)) continue;
    const normalized = normalizeUrl(trimmed);
    if (!normalized) continue;
    try {
      const u = new URL(normalized);
      // "N/A" becomes https://n/A (host "n", path "/A") — treat as absent
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
function formatDistanceLabel(miles: string | number | null | undefined): string | null {
  const parsed = parseDistanceMiles(miles);
  if (parsed == null) return null;
  if (/mi\b/i.test(String(miles))) return String(miles).trim();
  return `${parsed} mi`;
}

const hasStructuredDataKeys = (parsed: any): boolean => {
  if (!parsed || typeof parsed !== 'object') return false;
  // Check for nested structure (analysis.*)
  if (parsed.analysis && typeof parsed.analysis === 'object') {
    return !!(
      parsed.analysis.triageResult ||
      parsed.analysis.coverageResult ||
      parsed.analysis.diyResults ||
      parsed.analysis.serviceResults ||
      parsed.analysis.checkpointSummary ||
      parsed.analysis.checkpointDetails
    );
  }
  // Check for flat structure
  return !!(
    parsed.triageResult ||
    parsed.diyResults ||
    parsed.serviceResults ||
    parsed.coverageResult ||
    parsed.checkpointSummary ||
    parsed.checkpointDetails
  );
};

const getPreviewText = (value?: string, max = 240): string | undefined => {
  if (!value) return undefined;
  const plain = value
    .replace(/[`*_>#]/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return (
    plain
      .slice(0, max)
      .trim()
      .replace(/[.,!?;:]?$/, '') + '…'
  );
};

const MessageAvatar = React.memo(({ role }: { role: 'user' | 'assistant' }) => {
  const isUser = role === 'user';
  return (
    <View
      className={`h-8 w-8 items-center justify-center rounded-full ${
        isUser ? 'bg-primary' : 'bg-secondary'
      }`}>
      <Icon
        as={isUser ? User : Bot}
        size={16}
        className={isUser ? 'text-primary-foreground' : 'text-secondary-foreground'}
      />
    </View>
  );
});

const ProductCard = React.memo(({ product }: { product: Product }) => {
  // Determine an image source: prefer explicit image_url
  const imageSrc = product.image_url || null;
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const itemName =
    product.item_name || product.product_name || product.description || 'Product';
  const productPageUrl = useMemo(
    () => resolveProductPageUrl(product.store_url, product.url),
    [product.store_url, product.url]
  );

  const handleViewProduct = useCallback(() => {
    if (productPageUrl) {
      Linking.openURL(productPageUrl);
    }
  }, [productPageUrl]);

  return (
    <View className="mb-3 w-full rounded-lg border border-border bg-background p-3">
      <View className="mb-2">
        <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
          {itemName}
        </Text>
        {product.vendor && (
          <Text className="mt-1 text-xs text-muted-foreground">{product.vendor}</Text>
        )}
      </View>

      {imageSrc && (
        <View className="mb-2 h-32 w-full overflow-hidden rounded-md">
          {imageLoading && !imageError && (
            <View className="absolute inset-0 z-10 flex-col gap-2 bg-muted/30 p-2">
              <Skeleton className="h-6 w-full rounded" />
              <Skeleton className="h-6 w-[90%] rounded" />
              <Skeleton className="h-6 w-full rounded" />
              <Skeleton className="h-6 w-[70%] rounded" />
            </View>
          )}
          {imageError ? (
            <View className="flex h-full w-full items-center justify-center bg-muted">
              <Icon as={FileText} size={24} className="text-muted-foreground" />
              <Text className="mt-1 text-xs text-muted-foreground">Image unavailable</Text>
            </View>
          ) : (
            <Image
              source={{ uri: imageSrc }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              priority="normal"
              cachePolicy="memory-disk"
              transition={200}
              onLoadStart={() => setImageLoading(true)}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
            />
          )}
        </View>
      )}

      <View className="mb-2 space-y-1">
        {(product.price || product.item_price) && (
          <Text className="text-sm font-semibold text-primary">
            {product.price || product.item_price}
          </Text>
        )}
        {(product.rating || product.reviews) && (
          <View className="flex-row items-center gap-2">
            {product.rating && (
              <>
                <Icon as={Star} size={16} className="text-warning" />
                <Text className="text-sm text-foreground">{product.rating}</Text>
              </>
            )}
            {product.reviews && (
              <Text className="text-xs text-muted-foreground">
                {formatReviewCountLabel(product.reviews)}
              </Text>
            )}
          </View>
        )}
      </View>

      {productPageUrl && (
        <Button onPress={handleViewProduct} variant="outline" className="w-full">
          <Text>View Product</Text>
        </Button>
      )}
    </View>
  );
});

const YouTubeEmbed = React.memo(({ videoUrl }: { videoUrl: string }) => {
  const videoId = useMemo(() => getYouTubeVideoId(videoUrl), [videoUrl]);

  if (!videoId) {
    return null;
  }

  return (
    <View className="mb-2 w-full overflow-hidden rounded-md">
      <YoutubePlayer
        height={192}
        videoId={videoId}
        play={false}
        webViewProps={{
          androidLayerType: 'hardware',
        }}
      />
    </View>
  );
});

const ServiceProviderCard = React.memo(
  ({
    provider,
    saveMeta,
  }: {
    provider: ServiceProvider;
    saveMeta?: SaveServiceProviderMeta;
  }) => {
  const { isSaved, saveProvider, removeProvider, savedProviders } = useSavedServiceProviders();
  const [savePending, setSavePending] = useState(false);
  const saved = isSaved(provider);
  const savedRow = saved
    ? savedProviders.find(
        (row) => buildServiceProviderDedupeKey(row) === buildServiceProviderDedupeKey(provider)
      )
    : undefined;

  const handleToggleSave = useCallback(async () => {
    if (savePending) return;
    setSavePending(true);
    try {
      if (saved && savedRow) {
        await removeProvider(savedRow.id);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      const result = await saveProvider(provider, saveMeta);
      if (result === 'saved' || result === 'already_saved') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavePending(false);
    }
  }, [savePending, saved, savedRow, removeProvider, saveProvider, provider, saveMeta]);

  const linkStr = typeof provider.link === 'string' ? provider.link : undefined;
  const websiteStr = typeof provider.website === 'string' ? provider.website : undefined;

  const primaryLink = useMemo(
    () => normalizeUrl(linkStr) || normalizeUrl(websiteStr) || undefined,
    [linkStr, websiteStr]
  );
  const primaryLinkLabel = 'Website';

  const isPrimaryLinkValid = typeof primaryLink === 'string' && /^https?:\/\//i.test(primaryLink);
  const isDirectionsLinkValid =
    typeof provider.directions === 'string' &&
    !isVertexGroundingRedirectUrl(provider.directions) &&
    (provider.directions.startsWith('http://') || provider.directions.startsWith('https://'));

  // Extract rating number if available
  const ratingValue =
    provider.ratings && typeof provider.ratings === 'string'
      ? provider.ratings.split('/')[0].trim()
      : null;
  const hasRating = hasValue(ratingValue) && ratingValue !== 'N/A' && ratingValue !== '0';
  const hasReviews = hasValue(provider.reviews);
  const distanceLabel = formatDistanceLabel(provider.distance_miles);
  const hasDistance = !!distanceLabel;
  const hasContact = hasValue(provider.contact_info);
  const hasLocation = hasValue(provider.location);
  const hasAdditionalInfo =
    hasValue(provider.additional_information) &&
    provider.additional_information?.toLowerCase() !== 'no additional information available.';
  const hasSpecialties = hasValue(provider.specialties);

  const handlePrimaryLink = useCallback(() => {
    if (primaryLink) {
      Linking.openURL(primaryLink);
    }
  }, [primaryLink]);

  const handleDirections = useCallback(() => {
    if (provider.directions) {
      Linking.openURL(provider.directions);
    }
  }, [provider.directions]);

  // Show card if provider has a name
  if (!provider.name) {
    return null;
  }

  return (
    <View className="mb-3 rounded-lg border border-border bg-background p-3">
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="flex-1 font-semibold text-foreground" numberOfLines={2}>
          {provider.name}
        </Text>
        <View className="ml-2 flex-row items-center gap-1">
          <Pressable
            onPress={handleToggleSave}
            disabled={savePending}
            accessibilityLabel={saved ? 'Remove from saved providers' : 'Save provider'}
            className="rounded-full p-1">
            <Icon
              as={Heart}
              size={20}
              className={saved ? 'text-red-500' : 'text-muted-foreground'}
            />
          </Pressable>
          {provider.authorized === 'True' && (
            <View className="flex-row items-center gap-1 rounded-full bg-info/10 px-2 py-1">
              <Icon as={CheckCircle} size={16} className="text-info" />
              <Text className="text-xs text-info">Authorized</Text>
            </View>
          )}
        </View>
      </View>

      {(hasRating || hasReviews || hasDistance) && (
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          {hasRating && (
            <>
              <Icon as={Star} size={16} className="text-warning" />
              <Text className="text-sm text-foreground">{ratingValue}</Text>
            </>
          )}
          {hasDistance && (
            <Text className="text-xs text-muted-foreground">{distanceLabel}</Text>
          )}
          {hasReviews && (
            <Text className="text-xs text-muted-foreground">
              ({formatReviewCountLabel(provider.reviews)})
            </Text>
          )}
        </View>
      )}

      {hasAdditionalInfo && (
        <Text className="mb-2 text-sm text-muted-foreground" numberOfLines={3}>
          {provider.additional_information}
        </Text>
      )}

      <View className="mb-2 space-y-1">
        {hasContact && (
          <View className="flex-row items-center gap-2">
            <Icon as={Phone} size={16} className="text-muted-foreground" />
            <Text className="flex-1 text-sm text-foreground">{provider.contact_info}</Text>
          </View>
        )}
        {hasLocation && (
          <View className="flex-row items-center gap-2">
            <Icon as={Map} size={16} className="text-muted-foreground" />
            <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
              {provider.location}
            </Text>
          </View>
        )}
      </View>

      {hasSpecialties && (
        <View className="mb-2">
          <Text className="text-xs font-semibold text-muted-foreground">Specialties</Text>
          <Text className="text-xs text-foreground">{provider.specialties}</Text>
        </View>
      )}

      {(isPrimaryLinkValid || isDirectionsLinkValid) && (
        <View className="flex-row gap-2">
          {isPrimaryLinkValid && primaryLink && (
            <Button onPress={handlePrimaryLink} variant="outline" className="flex-1">
              <Text>{primaryLinkLabel}</Text>
            </Button>
          )}
          {isDirectionsLinkValid && provider.directions && (
            <Button onPress={handleDirections} variant="default" className="flex-1">
              <Text>Directions</Text>
            </Button>
          )}
        </View>
      )}
    </View>
  );
});

const StructuredResponse = React.memo(
  ({
    data,
    saveMeta,
  }: {
    data: StructuredResponseData;
    saveMeta?: SaveServiceProviderMeta;
  }) => {
  const markdownStyles = useMarkdownStyles(false);

  // Support both nested (analysis.*) and flat structures (top-level keys)
  const analysis = data.analysis || ({} as NonNullable<StructuredResponseData['analysis']>);
  const triage = analysis?.triageResult || (data as any)?.triageResult;
  const checkpointSummary = analysis?.checkpointSummary;
  const coverage = analysis?.coverageResult || (data as any)?.coverageResult;
  const diy = analysis?.diyResults || (data as any)?.diyResults;
  const service = analysis?.serviceResults || (data as any)?.serviceResults;
  const costEstimation =
    (data as any)?.costEstimationResults || (data as any)?.analysis?.costEstimationResults;

  // Check for clarification needs
  const needsClarification = !!(triage?.needs_clarification === true);
  const hasClarificationQuestions = !!(
    needsClarification &&
    Array.isArray(triage?.clarification_questions) &&
    triage.clarification_questions.length > 0
  );

  // Get title text (check both nested and flat structures)
  const rawTitle =
    typeof analysis?.title === 'string' && analysis.title.trim()
      ? analysis.title.trim()
      : typeof data?.title === 'string' && data.title.trim()
        ? data.title.trim()
        : undefined;

  const diagnosisPreview =
    !needsClarification && typeof triage?.diagnosis === 'string'
      ? getPreviewText(triage.diagnosis)
      : undefined;

  const clarificationPreview = needsClarification
    ? getPreviewText(triage?.message || triage?.diagnosis)
    : undefined;

  const displayTitle = rawTitle || (needsClarification ? clarificationPreview : diagnosisPreview);

  // Memoize allProviders array processing
  const allProviders = useMemo(() => {
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

    return allProvidersRaw
      .filter(providerHasValidData)
      .map(normalizeProvider)
      .filter(Boolean) as ServiceProvider[];
  }, [service]);

  // Memoize section flags
  const hasTriage = useMemo(
    () =>
      !!(
        triage?.diagnosis &&
        typeof triage.diagnosis === 'string' &&
        triage.diagnosis.trim() !== ''
      ),
    [triage]
  );

  const hasCheckpointSummary = useMemo(
    () =>
      !!(
        checkpointSummary &&
        (checkpointSummary.checkpointsAnalyzed ||
          (checkpointSummary.issuesDetected && checkpointSummary.issuesDetected.length > 0) ||
          checkpointSummary.overallCondition ||
          (checkpointSummary.locations && checkpointSummary.locations.length > 0))
      ),
    [checkpointSummary]
  );

  const hasCoverage = useMemo(
    () => !needsClarification && !!(coverage && (coverage.warrantyInfo || coverage.insuranceInfo)),
    [needsClarification, coverage]
  );

  const diyCostBlock = useMemo(() => getDiyCostEstimatesBlock(diy), [diy]);
  const hasDiyCostInDiy = useMemo(
    () => !!(diyCostBlock && diyCostBlockHasContent(diyCostBlock)),
    [diyCostBlock]
  );

  const hasDIY = useMemo(
    () =>
      !needsClarification &&
      !!(
        diy &&
        (getDiyHireProfessionalRecommended(diy) ||
          hasDiyCostInDiy ||
          diy.diySteps?.summary ||
          (diy.diySteps?.steps && diy.diySteps.steps.length > 0) ||
          (diy.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0) ||
          (diy.recommendedProducts?.products && diy.recommendedProducts.products.length > 0))
      ),
    [needsClarification, diy, hasDiyCostInDiy]
  );

  const hasService = useMemo(
    () => !needsClarification && allProviders.length > 0,
    [needsClarification, allProviders]
  );

  const hasCostEstimates = useMemo(
    () => !needsClarification && !!(costEstimation && costEstimation.costEstimates),
    [needsClarification, costEstimation]
  );

  return (
    <View className="w-full space-y-3">
      {displayTitle && (
        <View className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Text className="text-md font-semibold text-foreground">{displayTitle}</Text>
        </View>
      )}
      <Accordion type="single" collapsible defaultValue={hasCheckpointSummary ? "checkpoint-summary" : "triage"}>
        {(hasTriage || needsClarification) && (
          <AccordionItem value="triage" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Stethoscope} size={16} className="text-info" />
                <Text className="font-medium text-foreground">
                  {needsClarification ? 'Clarification Needed' : 'Triage Summary'}
                </Text>
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              {needsClarification && hasClarificationQuestions ? (
                <View className="space-y-3">
                  {triage.message && (
                    <Text className="mb-2 text-sm text-muted-foreground">{triage.message}</Text>
                  )}
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-foreground">
                      Please provide more information:
                    </Text>
                    {triage.clarification_questions.map((question: string, index: number) => (
                      <View key={index} className="flex-row gap-2">
                        <Text className="text-sm font-medium text-foreground">{index + 1}.</Text>
                        <Text className="flex-1 text-sm text-foreground">{question}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : hasTriage ? (
                <Markdown style={markdownStyles} rules={markdownRules}>
                  {triage!.diagnosis!}
                </Markdown>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        )}

        {hasCheckpointSummary && (
          <AccordionItem value="checkpoint-summary" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Sparkles} size={16} className="text-purple-600" />
                <Text className="font-medium text-foreground">Checkpoint Summary</Text>
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              <View className="space-y-3">
                {checkpointSummary?.checkpointsAnalyzed && (
                  <View className="flex-row items-start gap-2">
                    <Text className="text-sm font-medium text-muted-foreground min-w-[140px]">
                      Checkpoints Analyzed:
                    </Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {checkpointSummary.checkpointsAnalyzed}
                    </Text>
                  </View>
                )}
                {(checkpointSummary as any)?.queryType && (
                  <View className="flex-row items-start gap-2">
                    <Text className="text-sm font-medium text-muted-foreground min-w-[140px]">
                      Query Type:
                    </Text>
                    <View className="rounded-md border border-border bg-background px-2 py-1">
                      <Text className="text-xs text-foreground capitalize">
                        {(checkpointSummary as any).queryType}
                      </Text>
                    </View>
                  </View>
                )}
                {checkpointSummary?.locations && checkpointSummary.locations.length > 0 && (
                  <View className="flex-row items-start gap-2">
                    <Text className="text-sm font-medium text-muted-foreground min-w-[140px]">
                      Locations:
                    </Text>
                    <View className="flex-1 flex-row flex-wrap gap-1">
                      {checkpointSummary.locations.map((location, idx) => (
                        <View
                          key={idx}
                          className="rounded-md bg-secondary px-2 py-1"
                        >
                          <Text className="text-xs text-secondary-foreground">{location}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {(checkpointSummary as any)?.dateRange && (
                  <View className="flex-row items-start gap-2">
                    <Text className="text-sm font-medium text-muted-foreground min-w-[140px]">
                      Date Range:
                    </Text>
                    <Text className="flex-1 text-sm text-foreground">
                      {(checkpointSummary as any).dateRange}
                    </Text>
                  </View>
                )}
                {checkpointSummary?.overallCondition && (
                  <View className="flex-row items-start gap-2">
                    <Text className="text-sm font-medium text-muted-foreground min-w-[140px]">
                      Overall Condition:
                    </Text>
                    <Text className="flex-1 text-sm text-foreground">
                      {checkpointSummary.overallCondition}
                    </Text>
                  </View>
                )}
                {checkpointSummary?.issuesDetected && checkpointSummary.issuesDetected.length > 0 && (
                  <View className="flex-row items-start gap-2">
                    <Text className="text-sm font-medium text-muted-foreground min-w-[140px]">
                      Issues Detected:
                    </Text>
                    <View className="flex-1 space-y-1">
                      {checkpointSummary.issuesDetected.map((issue, idx) => (
                        <View key={idx} className="flex-row gap-2">
                          <Text className="text-sm text-foreground">•</Text>
                          <Text className="flex-1 text-sm text-foreground">{issue}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </AccordionContent>
          </AccordionItem>
        )}

        {(analysis as any)?.checkpointDetails && Array.isArray((analysis as any).checkpointDetails) && (analysis as any).checkpointDetails.length > 0 && (
          <AccordionItem value="checkpoint-details" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Info} size={16} className="text-info" />
                <Text className="font-medium text-foreground">Checkpoint Details</Text>
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              <View className="space-y-4">
                {(analysis as any).checkpointDetails.map((checkpoint: any, idx: number) => (
                  <View key={idx} className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                    <Text className="text-sm font-semibold text-foreground">
                      {checkpoint.name || `Checkpoint ${idx + 1}`}
                    </Text>
                    {checkpoint.location && (
                      <View className="flex-row items-start gap-2">
                        <Text className="text-xs font-medium text-muted-foreground min-w-[80px]">
                          Location:
                        </Text>
                        <Text className="flex-1 text-xs text-foreground">{checkpoint.location}</Text>
                      </View>
                    )}
                    {checkpoint.date && (
                      <View className="flex-row items-start gap-2">
                        <Text className="text-xs font-medium text-muted-foreground min-w-[80px]">
                          Date:
                        </Text>
                        <Text className="flex-1 text-xs text-foreground">{checkpoint.date}</Text>
                      </View>
                    )}
                    {checkpoint.summary && (
                      <View className="flex-row items-start gap-2">
                        <Text className="text-xs font-medium text-muted-foreground min-w-[80px]">
                          Summary:
                        </Text>
                        <Text className="flex-1 text-xs text-foreground">{checkpoint.summary}</Text>
                      </View>
                    )}
                    {checkpoint.detectedItems && checkpoint.detectedItems.length > 0 && (
                      <View className="space-y-1">
                        <Text className="text-xs font-medium text-muted-foreground">Detected Items:</Text>
                        <View className="flex-row flex-wrap gap-1">
                          {checkpoint.detectedItems.map((item: string, i: number) => (
                            <View key={i} className="rounded-md bg-secondary px-2 py-0.5">
                              <Text className="text-xs text-secondary-foreground">{item}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    {checkpoint.conditions && checkpoint.conditions.length > 0 && (
                      <View className="space-y-1">
                        <Text className="text-xs font-medium text-muted-foreground">Conditions:</Text>
                        {checkpoint.conditions.map((condition: string, i: number) => (
                          <View key={i} className="flex-row gap-1">
                            <Text className="text-xs text-foreground">•</Text>
                            <Text className="flex-1 text-xs text-foreground">{condition}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {checkpoint.issues && checkpoint.issues.length > 0 && (
                      <View className="space-y-1">
                        <Text className="text-xs font-medium text-destructive">Issues:</Text>
                        {checkpoint.issues.map((issue: string, i: number) => (
                          <View key={i} className="flex-row gap-1">
                            <Text className="text-xs text-destructive">•</Text>
                            <Text className="flex-1 text-xs text-destructive">{issue}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </AccordionContent>
          </AccordionItem>
        )}

        {(analysis as any)?.insights && typeof (analysis as any).insights === 'object' && Object.keys((analysis as any).insights).length > 0 && (
          <AccordionItem value="checkpoint-insights" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Lightbulb} size={16} className="text-warning" />
                <Text className="font-medium text-foreground">Insights & Recommendations</Text>
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              <View className="space-y-3">
                {(analysis as any).insights.changes && (
                  <View className="space-y-1">
                    <Text className="text-sm font-semibold text-warning">Changes Observed</Text>
                    <Text className="text-sm text-foreground">{(analysis as any).insights.changes}</Text>
                  </View>
                )}
                {(analysis as any).insights.patterns && (
                  <View className="space-y-1">
                    <Text className="text-sm font-semibold text-warning">Patterns Identified</Text>
                    <Text className="text-sm text-foreground">{(analysis as any).insights.patterns}</Text>
                  </View>
                )}
                {(analysis as any).insights.recommendations && (
                  <View className="space-y-1">
                    <Text className="text-sm font-semibold text-warning">Recommendations</Text>
                    <Text className="text-sm text-foreground">{(analysis as any).insights.recommendations}</Text>
                  </View>
                )}
              </View>
            </AccordionContent>
          </AccordionItem>
        )}

        {hasCoverage && (
          <AccordionItem value="coverage" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="w-full flex-row items-center gap-2">
                <Icon as={ShieldCheck} size={16} className="text-success" />
                <Text className="flex-1 font-medium text-foreground">Coverage Analysis</Text>
                <CheckpointAccordionBranchBadge
                  branch="coverage"
                  analysis={analysis}
                  sectionReady={hasCoverage}
                />
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              {coverage?.warrantyInfo && (
                <View className="mb-3">
                  <Text className="mb-1 text-sm font-semibold text-success">
                    Warranty Information
                  </Text>
                  <Markdown style={markdownStyles} rules={markdownRules}>
                    {coverage.warrantyInfo}
                  </Markdown>
                </View>
              )}
              {coverage?.insuranceInfo && (
                <View>
                  <Text className="mb-1 text-sm font-semibold text-success">
                    Insurance Information
                  </Text>
                  <Markdown style={markdownStyles} rules={markdownRules}>
                    {coverage.insuranceInfo}
                  </Markdown>
                </View>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {hasDIY && (
          <AccordionItem value="diy" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="w-full flex-row items-center gap-2">
                <Icon as={Wrench} size={16} className="text-warning" />
                <Text className="flex-1 font-medium text-foreground">DIY Recommendations</Text>
                <CheckpointAccordionBranchBadge
                  branch="diy"
                  analysis={analysis}
                  sectionReady={hasDIY}
                />
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              {getDiyHireProfessionalRecommended(diy) && (
                <Alert icon={AlertTriangle} variant="destructive" className="mb-3">
                  <AlertTitle>Professional help recommended</AlertTitle>
                  <AlertDescription>
                    This repair may involve gas, electrical, structural, or other hazards. Consider
                    hiring a licensed professional before attempting DIY work.
                  </AlertDescription>
                </Alert>
              )}
              {diyCostBlock && diyCostBlockHasContent(diyCostBlock) && (
                <View className="mb-3 rounded-md border border-amber-800/30 bg-amber-950/20 p-3">
                  <View className="mb-2 flex-row items-center gap-2">
                    <Icon as={DollarSign} size={16} className="text-amber-600" />
                    <Text className="text-sm font-semibold text-foreground">Estimated DIY cost</Text>
                  </View>
                  <Text className="mb-2 text-xs text-muted-foreground">
                    Indicative range from our repair library—not a quote. Verify with local pricing.
                  </Text>
                  {diyCostBlock.repair_type ? (
                    <Text className="mb-1 text-xs text-muted-foreground">
                      <Text className="font-medium text-foreground">Repair type: </Text>
                      {String(diyCostBlock.repair_type)}
                    </Text>
                  ) : null}
                  {diyCostBlock.DIY?.cost_range ? (
                    <Text className="mb-1 text-sm text-foreground">
                      <Text className="font-medium">Typical range: </Text>
                      {String(diyCostBlock.DIY.cost_range)}
                    </Text>
                  ) : null}
                  {Array.isArray(diyCostBlock.DIY?.includes) && diyCostBlock.DIY.includes.length > 0 ? (
                    <View className="mb-2">
                      <Text className="mb-1 text-sm font-medium text-foreground">Includes</Text>
                      {diyCostBlock.DIY.includes.map((it: string, i: number) => (
                        <Text key={i} className="pl-2 text-sm text-foreground">
                          • {it}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {diyCostBlock.DIY?.savings ? (
                    <Text className="mb-1 text-sm text-foreground">
                      <Text className="font-medium">Savings: </Text>
                      {String(diyCostBlock.DIY.savings)}
                    </Text>
                  ) : null}
                  {diyCostBlock.DIY?.complexity ? (
                    <Text className="text-sm text-foreground">
                      <Text className="font-medium">Complexity: </Text>
                      {String(diyCostBlock.DIY.complexity)}
                    </Text>
                  ) : null}
                </View>
              )}
              {diy?.diySteps?.summary && (
                <View className="mb-3">
                  <Text className="mb-1 text-sm font-semibold text-warning">Summary</Text>
                  <Markdown style={markdownStyles} rules={markdownRules}>
                    {diy.diySteps.summary}
                  </Markdown>
                </View>
              )}

              {diy?.diySteps?.steps && diy.diySteps.steps.length > 0 && (
                <View className="mb-3">
                  <Text className="mb-2 text-sm font-semibold text-warning">
                    Step-by-Step Instructions
                  </Text>
                  {diy.diySteps.steps.map((step: any, idx: number) => (
                    <View key={idx} className="mb-2 flex-row gap-2">
                      <Text className="text-sm font-medium text-foreground">{idx + 1}.</Text>
                      <Text className="flex-1 text-sm text-foreground">{step.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              {diy?.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0 && (
                <View className="mb-3">
                  <Text className="mb-2 text-sm font-semibold text-warning">Video Tutorials</Text>
                  {diy.youtubeSearch.videos.map((video: any, i: number) => (
                    <View key={i} className="mb-3">
                      <YouTubeEmbed videoUrl={video.url} />
                      <Text className="mt-1 text-sm font-medium text-foreground" numberOfLines={2}>
                        {video.title || 'Video'}
                      </Text>
                      {video.description && (
                        <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                          {video.description}
                        </Text>
                      )}
                      <Button
                        onPress={() => Linking.openURL(video.url)}
                        variant="outline"
                        className="mt-2 w-full">
                        <Text>Watch on YouTube</Text>
                      </Button>
                    </View>
                  ))}
                </View>
              )}

              {diy?.recommendedProducts?.products &&
                diy.recommendedProducts.products.length > 0 && (
                  <View className="mb-3">
                    <Text className="mb-2 text-sm font-semibold text-warning">
                      Recommended Products
                    </Text>
                    {diy.recommendedProducts.products.map((product: Product, index: number) => (
                      <ProductCard key={index} product={product} />
                    ))}
                  </View>
                )}
            </AccordionContent>
          </AccordionItem>
        )}

        {hasService && (
          <AccordionItem value="service" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="w-full flex-row items-center gap-2">
                <Icon as={Users} size={16} className="text-indigo-600" />
                <Text className="flex-1 font-medium text-foreground">Service Recommendations</Text>
                <CheckpointAccordionBranchBadge
                  branch="service"
                  analysis={analysis}
                  sectionReady={hasService}
                />
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              <Text className="mb-2 text-sm font-semibold text-indigo-600">
                Local Service Providers
              </Text>
              {allProviders.length > 0 ? (
                allProviders.map((provider, index) => (
                  <ServiceProviderCard key={index} provider={provider} saveMeta={saveMeta} />
                ))
              ) : (
                <Text className="text-sm italic text-muted-foreground">
                  No service providers found for this location.
                </Text>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {hasCostEstimates && (
          <AccordionItem value="cost-estimates" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3">
              <View className="w-full flex-row items-center gap-2">
                <Icon as={DollarSign} size={16} className="text-purple-600" />
                <Text className="flex-1 font-medium text-foreground">Cost Estimates</Text>
                <CheckpointAccordionBranchBadge
                  branch="cost"
                  analysis={analysis}
                  sectionReady={hasCostEstimates}
                />
              </View>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border bg-background p-4">
              {typeof costEstimation.costEstimates === 'string' ? (
                <Text className="text-sm text-foreground">{costEstimation.costEstimates}</Text>
              ) : (
                <View className="space-y-3">
                  {costEstimation.costEstimates.repair_type && (
                    <View className="mb-2">
                      <Text className="text-sm font-semibold text-purple-600">Repair Type</Text>
                      <Text className="text-sm text-foreground">
                        {costEstimation.costEstimates.repair_type}
                      </Text>
                    </View>
                  )}

                  {costEstimation.costEstimates.DIY && (
                    <View className="mb-3 rounded-lg border border-border bg-background p-3">
                      <Text className="mb-2 text-sm font-semibold text-foreground">DIY Option</Text>
                      {costEstimation.costEstimates.DIY.cost_range && (
                        <View className="mb-2 flex-row items-start gap-2">
                          <Text className="text-sm font-medium text-muted-foreground">
                            Cost Range:
                          </Text>
                          <Text className="flex-1 text-sm font-semibold text-purple-600">
                            {costEstimation.costEstimates.DIY.cost_range}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.DIY.savings && (
                        <View className="mb-2 flex-row items-start gap-2">
                          <Text className="text-sm font-medium text-muted-foreground">
                            Savings:
                          </Text>
                          <Text className="flex-1 text-sm text-foreground">
                            {costEstimation.costEstimates.DIY.savings}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.DIY.complexity && (
                        <View className="mb-2 flex-row items-start gap-2">
                          <Text className="text-sm font-medium text-muted-foreground">
                            Complexity:
                          </Text>
                          <Text className="flex-1 text-sm text-foreground">
                            {costEstimation.costEstimates.DIY.complexity}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.DIY.includes &&
                        Array.isArray(costEstimation.costEstimates.DIY.includes) &&
                        costEstimation.costEstimates.DIY.includes.length > 0 && (
                          <View className="mt-2">
                            <Text className="mb-1 text-sm font-medium text-muted-foreground">
                              Includes:
                            </Text>
                            {costEstimation.costEstimates.DIY.includes.map(
                              (item: string, idx: number) => (
                                <View key={idx} className="mb-1 flex-row gap-2">
                                  <Text className="text-sm text-foreground">•</Text>
                                  <Text className="flex-1 text-sm text-foreground">{item}</Text>
                                </View>
                              )
                            )}
                          </View>
                        )}
                    </View>
                  )}

                  {costEstimation.costEstimates.Service && (
                    <View className="mb-3 rounded-lg border border-border bg-background p-3">
                      <Text className="mb-2 text-sm font-semibold text-foreground">
                        Professional Service
                      </Text>
                      {costEstimation.costEstimates.Service.cost_range && (
                        <View className="mb-2 flex-row items-start gap-2">
                          <Text className="text-sm font-medium text-muted-foreground">
                            Cost Range:
                          </Text>
                          <Text className="flex-1 text-sm font-semibold text-purple-600">
                            {costEstimation.costEstimates.Service.cost_range}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.Service.benefits && (
                        <View className="mb-2 flex-row items-start gap-2">
                          <Text className="text-sm font-medium text-muted-foreground">
                            Benefits:
                          </Text>
                          <Text className="flex-1 text-sm text-foreground">
                            {costEstimation.costEstimates.Service.benefits}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.Service.complexity && (
                        <View className="mb-2 flex-row items-start gap-2">
                          <Text className="text-sm font-medium text-muted-foreground">
                            Complexity:
                          </Text>
                          <Text className="flex-1 text-sm text-foreground">
                            {costEstimation.costEstimates.Service.complexity}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.Service.includes &&
                        Array.isArray(costEstimation.costEstimates.Service.includes) &&
                        costEstimation.costEstimates.Service.includes.length > 0 && (
                          <View className="mt-2">
                            <Text className="mb-1 text-sm font-medium text-muted-foreground">
                              Includes:
                            </Text>
                            {costEstimation.costEstimates.Service.includes.map(
                              (item: string, idx: number) => (
                                <View key={idx} className="mb-1 flex-row gap-2">
                                  <Text className="text-sm text-foreground">•</Text>
                                  <Text className="flex-1 text-sm text-foreground">{item}</Text>
                                </View>
                              )
                            )}
                          </View>
                        )}
                    </View>
                  )}

                  {costEstimation.costEstimates.comparison && (
                    <View className="mt-3 rounded-lg bg-muted p-3">
                      <Text className="mb-2 text-sm font-semibold text-foreground">
                        Comparison & Considerations
                      </Text>
                      {costEstimation.costEstimates.comparison.diy_savings && (
                        <View className="mb-1 flex-row items-start gap-2">
                          <Text className="text-sm text-foreground">•</Text>
                          <Text className="flex-1 text-sm text-foreground">
                            DIY Savings: {costEstimation.costEstimates.comparison.diy_savings}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.comparison.professional_benefits && (
                        <View className="mb-1 flex-row items-start gap-2">
                          <Text className="text-sm text-foreground">•</Text>
                          <Text className="flex-1 text-sm text-foreground">
                            Professional Benefits:{' '}
                            {costEstimation.costEstimates.comparison.professional_benefits}
                          </Text>
                        </View>
                      )}
                      {costEstimation.costEstimates.comparison.considerations && (
                        <View className="mb-1 flex-row items-start gap-2">
                          <Text className="text-sm text-foreground">•</Text>
                          <Text className="flex-1 text-sm text-foreground">
                            Considerations: {costEstimation.costEstimates.comparison.considerations}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </View>
  );
});

// Helper to extract markdown and JSON from content
const extractContentParts = (
  content: string,
  isUser: boolean
): { structuredData: StructuredResponseData | null; markdownContent: string } => {
  if (isUser || !content) {
    return { structuredData: null, markdownContent: content };
  }

  try {
    const contentToParse = content.trim();

    // First, look for markdown code block followed by a JSON code block
    // This handles: **Agent**: ```markdown ... ``` ```json ... ```
    // Try multiple patterns to handle different newline variations

    let combinedMatch = contentToParse.match(
      /```markdown\s*\n([\s\S]*?)\n```\s*\n?```json\s*\n([\s\S]*?)\n```/
    );

    if (!combinedMatch) {
      // Try without requiring newline after closing markdown backticks
      combinedMatch = contentToParse.match(
        /```markdown\s*\n([\s\S]*?)```\s*\n?```json\s*\n([\s\S]*?)```/
      );
    }

    if (combinedMatch) {
      const markdownText = combinedMatch[1].trim();
      const jsonStr = combinedMatch[2].trim();

      try {
        const parsed = JSON.parse(jsonStr);
        if (hasStructuredDataKeys(parsed)) {
          // Extract any text before the markdown block (like "**Analysis Agent**:")
          const preMarkdownText = contentToParse
            .substring(0, contentToParse.indexOf(combinedMatch[0]))
            .trim();
          // Don't include the markdown code block wrapper, just the content
          const fullMarkdownContent = preMarkdownText
            ? `${preMarkdownText}\n\n${markdownText}`
            : markdownText;
          return { structuredData: parsed, markdownContent: fullMarkdownContent };
        }
      } catch (e) {
        // Failed to parse JSON from combined blocks
      }
    }

    // Second, try to find just a JSON code block (no markdown wrapper)
    const jsonMatch = contentToParse.match(/```json\s*\n?([\s\S]*?)```/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (hasStructuredDataKeys(parsed)) {
          // Remove the JSON code block from content to get markdown
          const markdownContent = contentToParse.replace(jsonMatch[0], '').trim();
          return { structuredData: parsed, markdownContent };
        }
      } catch (e) {
        // Failed to parse JSON from code block
      }
    }

    // Third, try to find any code block and see if it contains JSON
    const anyCodeBlockMatch = contentToParse.match(/```\s*\n?([\s\S]*?)```/);

    if (anyCodeBlockMatch) {
      const codeBlockContent = anyCodeBlockMatch[1].trim();
      try {
        const parsed = JSON.parse(codeBlockContent);
        if (hasStructuredDataKeys(parsed)) {
          const markdownContent = contentToParse.replace(anyCodeBlockMatch[0], '').trim();
          return { structuredData: parsed, markdownContent };
        }
      } catch (e) {
        // Not JSON, continue
      }
    }

    // Finally, try parsing the entire content as JSON (fallback for non-markdown wrapped JSON)
    try {
      const parsed = JSON.parse(contentToParse);
      if (hasStructuredDataKeys(parsed)) {
        return { structuredData: parsed, markdownContent: '' };
      }
    } catch (e) {
      // Not valid JSON, treat as plain markdown
    }
  } catch (e) {
    // Error in content parsing
  }

  return { structuredData: null, markdownContent: content };
};

const MessageContent = React.memo(
  ({
    content,
    isUser,
    messageId,
    sessionId,
  }: {
    content: string;
    isUser: boolean;
    messageId: string;
    sessionId?: string;
  }) => {
  const markdownStyles = useMarkdownStyles(isUser);

  // Memoize structured data and markdown content parsing
  const { structuredData, plainContent } = useMemo(() => {
    const { structuredData, markdownContent } = extractContentParts(content, isUser);
    return { structuredData, plainContent: markdownContent };
  }, [content, isUser]);

  if (structuredData) {
    // console.log('STRUCTURED DATA:', structuredData);
    return (
      <View className="w-full min-w-full">
        {/* {plainContent && (
          <Markdown style={markdownStyles} rules={markdownRules}>
            {plainContent}
          </Markdown>
        )} */}
        <StructuredResponse
          data={structuredData}
          saveMeta={{
            source: 'chat',
            messageId,
            ...(sessionId ? { sessionId } : {}),
          }}
        />
      </View>
    );
  }

  // Render content with markdown support - natural width for text messages
  return (
    <Markdown style={markdownStyles} rules={markdownRules}>
      {content}
    </Markdown>
  );
});

const FilePreview = React.memo(
  ({ file, isUserMessage, onPress }: { file: NonNullable<Message['file']>; isUserMessage?: boolean; onPress?: () => void }) => {
    // Media dimensions constants
    const MEDIA_MAX_WIDTH = 200;
    const MEDIA_MIN_WIDTH = 200;
    const MEDIA_MAX_HEIGHT = 200;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const [imageError, setImageError] = useState(false);

    // Use stored dimensions if available, otherwise calculate on load
    const imageDimensions = useMemo(() => {
      if (!isImage) return null;

      // If dimensions are not available, return fixed size
      if (!file.width || !file.height) {
        return { width: MEDIA_MAX_WIDTH, height: MEDIA_MAX_HEIGHT };
      }

      // Calculate dimensions to fit within max constraints while maintaining aspect ratio
      let displayWidth = file.width;
      let displayHeight = file.height;

      if (file.width > MEDIA_MAX_WIDTH || file.height > MEDIA_MAX_HEIGHT) {
        const widthRatio = MEDIA_MAX_WIDTH / file.width;
        const heightRatio = MEDIA_MAX_HEIGHT / file.height;
        const ratio = Math.min(widthRatio, heightRatio);

        displayWidth = file.width * ratio;
        displayHeight = file.height * ratio;
      }

      return { width: displayWidth, height: displayHeight };
    }, [isImage, file.width, file.height]);

    // Video player hook - only create if video
    const player = useVideoPlayer(isVideo ? file.url : '', (player) => {
      player.pause();
    });

    return (
      <Pressable
        onPress={onPress}
        style={{ alignSelf: isUserMessage ? 'flex-end' : 'flex-start' }}>
        {isImage ? (
          imageError ? (
            <View className="flex-row items-center gap-2 rounded-lg border border-border bg-secondary p-3">
              <Icon as={FileText} size={20} className="text-muted-foreground" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {file.name}
                </Text>
                <Text className="text-xs text-destructive">Failed to load image</Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                width: imageDimensions?.width ?? MEDIA_MIN_WIDTH,
                height: imageDimensions?.height ?? MEDIA_MAX_HEIGHT,
              }}
              className="rounded-lg bg-muted">
              <Image
                source={{ uri: file.url }}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                className="rounded-lg"
                contentFit="cover"
                priority="high"
                cachePolicy="memory-disk"
                transition={200}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                placeholderContentFit="cover"
                onError={(e) => {
                  chatLog.error('image.load.failed');
                  setImageError(true);
                }}
              />
            </View>
          )
        ) : isVideo ? (
          <VideoView
            player={player}
            style={{ height: 200, minWidth: 100, maxWidth: MEDIA_MAX_WIDTH }}
            contentFit="contain"
            allowsPictureInPicture
          />
        ) : (
          <View className="flex-row items-center gap-2 rounded-lg border border-border bg-secondary p-3">
            <Icon as={FileText} size={20} className="text-muted-foreground" />
            <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
              {file.name}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }
);

function ChatMessage({ message, sessionId }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isLoading = message.role === 'assistant' && !message.content;
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showMediaDetail, setShowMediaDetail] = useState(false);
  const [copyStatus, setCopyStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Extract content parts once and memoize for both display and copy operations
  const extractedParts = useMemo(() => {
    return extractContentParts(message.content, isUser);
  }, [message.content, isUser]);

  const showEarlyLoading = !isUser && !message.content;

  const handleLongPress = useCallback(() => {
    if (!isLoading && message.content) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowContextMenu(true);
    }
  }, [isLoading, message.content]);

  const formatMessageContent = useCallback((content: string): string => {
    // Since we now extract markdown content separately,
    // we just need to convert it to WhatsApp format
    return markdownToWhatsapp(content);
  }, []);

  // Use the memoized extracted markdown content
  const getMarkdownContent = useCallback(() => {
    let markdown = extractedParts.markdownContent || message.content;

    // Final safety check: strip any remaining ```markdown wrappers
    if (markdown.includes('```markdown')) {
      const markdownWrapperMatch = markdown.match(/```markdown\s*\n([\s\S]*?)```/);
      if (markdownWrapperMatch) {
        const innerContent = markdownWrapperMatch[1].trim();
        const prefix = markdown.substring(0, markdown.indexOf(markdownWrapperMatch[0])).trim();
        markdown = prefix ? `${prefix}\n\n${innerContent}` : innerContent;
      } else {
        // Fallback: just remove the ```markdown and closing ```
        markdown = markdown
          .replace(/```markdown\s*\n/g, '')
          .replace(/\n```\s*$/g, '')
          .trim();
      }
    }

    return markdown;
  }, [extractedParts.markdownContent, message.content]);

  const handleCopyMessage = useCallback(async () => {
    try {
      const markdownContent = getMarkdownContent();
      const formattedText = formatMessageContent(markdownContent);
      await Clipboard.setStringAsync(formattedText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopyStatus({ type: 'success', message: 'Message copied to clipboard' });
      setShowContextMenu(false);
      // Auto-dismiss after 2 seconds
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCopyStatus({ type: 'error', message: 'Failed to copy message' });
      setShowContextMenu(false);
      // Auto-dismiss after 2 seconds
      setTimeout(() => setCopyStatus(null), 2000);
    }
  }, [formatMessageContent, getMarkdownContent]);

  const handleShareMessage = useCallback(async () => {
    try {
      const markdownContent = getMarkdownContent();
      const formattedText = formatMessageContent(markdownContent);
      await Share.share({
        message: formattedText,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowContextMenu(false);
    } catch (error) {
      chatLog.error('share.failed', undefined, error);
      setShowContextMenu(false);
    }
  }, [formatMessageContent, getMarkdownContent]);

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  return (
    <View className={`mb-4 flex-row gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <View className="hidden md:flex">
        <MessageAvatar role={message.role} />
      </View>
      <View className={`flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <Pressable onLongPress={handleLongPress} delayLongPress={500}>
          <View className={`overflow-hidden rounded-lg ${isUser ? 'bg-muted' : 'bg-secondary'}`}>
            {message.file && (
              <FilePreview
                file={message.file}
                isUserMessage={isUser}
                onPress={() => setShowMediaDetail(true)}
              />
            )}
            {showEarlyLoading ? (
              <>
                {message.agentSteps && message.agentSteps.length > 0 ? (
                  <View className="p-3">
                    <AgentStatus
                      steps={message.agentSteps}
                      messageContent={message.content}
                    />
                  </View>
                ) : (
                  <View className="p-3">
                    <TypingIndicator />
                  </View>
                )}
              </>
            ) : null}
            {message.content ? (
              <View className="flex flex-col gap-3 p-3">
                <MessageContent
                  content={message.content}
                  isUser={isUser}
                  messageId={message.id}
                  sessionId={sessionId}
                />
              </View>
            ) : null}
          </View>
        </Pressable>

        {copyStatus && (
          <View className="mt-2">
            <Alert
              icon={copyStatus.type === 'success' ? CheckCircle : AlertCircle}
              variant={copyStatus.type === 'error' ? 'destructive' : 'default'}
              className="py-2">
              <AlertDescription className="text-xs">{copyStatus.message}</AlertDescription>
            </Alert>
          </View>
        )}

        {message.createdAt && (
          <Text className="mt-1 text-xs text-muted-foreground">
            {new Date(
              message.createdAt instanceof Date ? message.createdAt : message.createdAt.toDate()
            ).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>

      {/* Contextual Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={handleCloseContextMenu}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleCloseContextMenu}
          className="flex-1 items-center justify-center bg-black/50">
          <View className="w-64 overflow-hidden rounded-lg bg-background shadow-lg">
            <TouchableOpacity
              onPress={handleCopyMessage}
              className="flex-row items-center gap-3 border-b border-border p-4 active:bg-secondary">
              <Icon as={Copy} size={20} className="text-foreground" />
              <Text className="text-base text-foreground">Copy Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShareMessage}
              className="flex-row items-center gap-3 p-4 active:bg-secondary">
              <Icon as={Share2} size={20} className="text-foreground" />
              <Text className="text-base text-foreground">Share</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Media Detail Modal */}
      {message.file && (
        <MediaDetailModal
          visible={showMediaDetail}
          file={message.file}
          onClose={() => setShowMediaDetail(false)}
          createdAt={
            message.createdAt instanceof Date
              ? message.createdAt
              : message.createdAt?.toDate
                ? message.createdAt.toDate()
                : undefined
          }
        />
      )}
    </View>
  );
}

export default React.memo(ChatMessage);
