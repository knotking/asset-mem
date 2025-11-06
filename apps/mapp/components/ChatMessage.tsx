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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Bot,
  FileText,
  ShieldCheck,
  Info,
  Wrench,
  Users,
  Phone,
  Map,
  Star,
  CheckCircle,
  Copy,
  AlertCircle,
  Share2,
} from 'lucide-react-native';
import type {
  Message,
  StructuredResponseData,
  ServiceProvider,
  Product,
} from '@homeapp/common/types';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import Markdown from 'react-native-markdown-display';
import { useMarkdownStyles, markdownRules } from '@/lib/markdown-styles';
import { markdownToWhatsapp, jsonToWhatsapp } from '@/lib/utils';
import TypingIndicator from './TypingIndicator';
import { AgentStatus } from './AgentStatus';

interface ChatMessageProps {
  message: Message;
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

  const website = p.website || p.url || p.link || undefined;
  const link = p.link || p.url || p.website || undefined;
  const directions = p.directions || p.directions_url || p.map_link || undefined;
  const contact_info =
    p.contact_info || p.phone || p.phoneNumber || p.contact || p.contactInfo || undefined;
  const location = p.location || p.address || p.address_line || undefined;
  const ratings = p.ratings || p.rating || undefined;
  const reviews = p.reviews || p.review_count || p.reviewCount || undefined;
  const specialties = p.specialties || p.services || undefined;
  const additional_information = p.additional_information || p.description || p.about || undefined;
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
    specialties: specialties != null ? String(specialties) : undefined,
    additional_information: additional_information != null ? String(additional_information) : '',
    authorized: authorized != null ? String(authorized) : '',
  } as ServiceProvider;
};

const providerHasValidData = (provider: any): boolean => {
  const nameCandidate =
    provider?.name ||
    provider?.business_name ||
    provider?.businessName ||
    provider?.title ||
    provider?.company ||
    provider?.provider ||
    provider?.store;
  return !!(nameCandidate && String(nameCandidate).trim() !== '');
};

const getProvidersArray = (providers: any): ServiceProvider[] => {
  if (!providers) return [];
  if (Array.isArray(providers)) return providers as ServiceProvider[];
  if (typeof providers === 'string') {
    try {
      const parsed = JSON.parse(providers);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (typeof providers === 'object') {
    const keys = ['providers', 'results', 'items', 'pros', 'list'];
    for (const k of keys) {
      if (Array.isArray((providers as any)[k])) return (providers as any)[k];
    }
  }
  return [];
};

const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const normalizeUrl = (u?: string): string | undefined => {
  if (!u || typeof u !== 'string') return undefined;
  const trimmed = u.trim();
  if (trimmed === '') return undefined;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    return url.toString();
  } catch {
    return undefined;
  }
};

const hasStructuredDataKeys = (parsed: any): boolean => {
  if (!parsed || typeof parsed !== 'object') return false;
  // Check for nested structure (analysis.*)
  if (parsed.analysis && typeof parsed.analysis === 'object') {
    return !!(
      parsed.analysis.triageResult ||
      parsed.analysis.coverageResult ||
      parsed.analysis.diyResults ||
      parsed.analysis.serviceResults
    );
  }
  // Check for flat structure
  return !!(
    parsed.triageResult ||
    parsed.diyResults ||
    parsed.serviceResults ||
    parsed.coverageResult
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

  const handleViewProduct = useCallback(() => {
    if (product.url) {
      Linking.openURL(product.url);
    }
  }, [product.url]);

  return (
    <View className="mb-3 w-full rounded-lg border border-border bg-background p-3">
      <View className="mb-2">
        <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
          {product.product_name || product.description || 'Product'}
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
              <Text className="text-xs text-muted-foreground">({product.reviews})</Text>
            )}
          </View>
        )}
      </View>

      {product.url && (
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

const ServiceProviderCard = React.memo(({ provider }: { provider: ServiceProvider }) => {
  const linkStr = typeof provider.link === 'string' ? provider.link : undefined;
  const websiteStr = typeof provider.website === 'string' ? provider.website : undefined;

  const primaryLink = useMemo(
    () => normalizeUrl(linkStr) || normalizeUrl(websiteStr) || undefined,
    [linkStr, websiteStr]
  );
  const isYelp = useMemo(() => !!primaryLink && primaryLink.includes('yelp.com'), [primaryLink]);
  const primaryLinkLabel = isYelp ? 'View on Yelp' : 'Website';

  const isPrimaryLinkValid = typeof primaryLink === 'string' && /^https?:\/\//i.test(primaryLink);
  const isDirectionsLinkValid =
    typeof provider.directions === 'string' &&
    (provider.directions.startsWith('http://') || provider.directions.startsWith('https://'));

  // Extract rating number if available
  const ratingValue =
    provider.ratings && typeof provider.ratings === 'string'
      ? provider.ratings.split('/')[0].trim()
      : null;
  const hasRating = hasValue(ratingValue) && ratingValue !== 'N/A' && ratingValue !== '0';
  const hasReviews = hasValue(provider.reviews);
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
        {provider.authorized === 'True' && (
          <View className="ml-2 flex-row items-center gap-1 rounded-full bg-info/10 px-2 py-1">
            <Icon as={CheckCircle} size={16} className="text-info" />
            <Text className="text-xs text-info">Authorized</Text>
          </View>
        )}
      </View>

      {(hasRating || hasReviews) && (
        <View className="mb-2 flex-row items-center gap-2">
          {hasRating && (
            <>
              <Icon as={Star} size={16} className="text-warning" />
              <Text className="text-sm text-foreground">{ratingValue}</Text>
            </>
          )}
          {hasReviews && (
            <Text className="text-xs text-muted-foreground">
              (
              {provider.reviews && !provider.reviews.toLowerCase().includes('review')
                ? provider.reviews
                : `${provider.reviews} reviews`}
              )
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

const StructuredResponse = React.memo(({ data }: { data: StructuredResponseData }) => {
  const markdownStyles = useMarkdownStyles(false);

  // Support both nested (analysis.*) and flat structures (top-level keys)
  const analysis = data.analysis || ({} as NonNullable<StructuredResponseData['analysis']>);
  const triage = analysis?.triageResult || (data as any)?.triageResult;
  const coverage = analysis?.coverageResult || (data as any)?.coverageResult;
  const diy = analysis?.diyResults || (data as any)?.diyResults;
  const service = analysis?.serviceResults || (data as any)?.serviceResults;

  // Memoize allProviders array processing
  const allProviders = useMemo(() => {
    const allProvidersRaw = [
      ...getProvidersArray(service?.localPros?.yelpAPIResults),
      ...getProvidersArray(service?.localPros?.serpAPIResults),
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

  const hasCoverage = useMemo(
    () => !!(coverage && (coverage.warrantyInfo || coverage.insuranceInfo)),
    [coverage]
  );

  const hasDIY = useMemo(
    () =>
      !!(
        diy &&
        (diy.diySteps?.summary ||
          (diy.diySteps?.steps && diy.diySteps.steps.length > 0) ||
          (diy.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0) ||
          (diy.recommendedProducts?.products && diy.recommendedProducts.products.length > 0))
      ),
    [diy]
  );

  const hasService = useMemo(() => allProviders.length > 0, [allProviders]);

  return (
    <Accordion type="single" collapsible defaultValue="triage">
      {hasTriage && (
        <AccordionItem value="triage" className="border-b border-border">
          <AccordionTrigger className="px-2 py-3">
            <View className="flex-row items-center gap-2">
              <Icon as={Info} size={16} className="text-info" />
              <Text className="font-medium text-foreground">Triage Summary</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-background p-4">
            <Markdown style={markdownStyles} rules={markdownRules}>
              {triage!.diagnosis!}
            </Markdown>
          </AccordionContent>
        </AccordionItem>
      )}

      {hasCoverage && (
        <AccordionItem value="coverage" className="border-b border-border">
          <AccordionTrigger className="px-2 py-3">
            <View className="flex-row items-center gap-2">
              <Icon as={ShieldCheck} size={16} className="text-success" />
              <Text className="font-medium text-foreground">Coverage Analysis</Text>
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
            <View className="flex-row items-center gap-2">
              <Icon as={Wrench} size={16} className="text-warning" />
              <Text className="font-medium text-foreground">DIY Recommendations</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-background p-4">
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

            {diy?.recommendedProducts?.products && diy.recommendedProducts.products.length > 0 && (
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
            <View className="flex-row items-center gap-2">
              <Icon as={Users} size={16} className="text-accent-foreground" />
              <Text className="font-medium text-foreground">Service Recommendations</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-background p-4">
            <Text className="mb-2 text-sm font-semibold text-foreground">
              Local Service Providers
            </Text>
            {allProviders.length > 0 ? (
              allProviders.map((provider, index) => (
                <ServiceProviderCard key={index} provider={provider} />
              ))
            ) : (
              <Text className="text-sm italic text-muted-foreground">
                No service providers found for this location.
              </Text>
            )}
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
});

const MessageContent = React.memo(({ content, isUser }: { content: string; isUser: boolean }) => {
  const markdownStyles = useMarkdownStyles(isUser);
  // Memoize structured data and plain content parsing
  const { structuredData, plainContent } = useMemo(() => {
    let parsedData: StructuredResponseData | null = null;
    let remainingContent = content;

    if (!isUser && content) {
      try {
        const contentToParse = content.trim();

        // Single parsing method: Extract JSON from markdown code block or parse directly
        const jsonMatch = contentToParse.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : contentToParse.trim();

        try {
          const parsed = JSON.parse(jsonStr);
          if (hasStructuredDataKeys(parsed)) {
            parsedData = parsed;
            // Remove the markdown wrapper from plain content if it existed
            remainingContent = jsonMatch ? contentToParse.replace(jsonMatch[0], '').trim() : '';
            console.log('✓ Parsed structured JSON response');
          }
        } catch (e) {
          // Not valid JSON, treat as plain text
          console.log('Failed to parse structured data:', e);
        }
      } catch (e) {
        console.log('Error in content parsing:', e);
        // Not a JSON object, treat as plain text
      }
    }

    return { structuredData: parsedData, plainContent: remainingContent };
  }, [content, isUser]);

  if (structuredData) {
    return (
      <View className="w-full min-w-full">
        {plainContent && (
          <Markdown style={markdownStyles} rules={markdownRules}>
            {plainContent}
          </Markdown>
        )}
        <StructuredResponse data={structuredData} />
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
  ({ file, isUserMessage }: { file: NonNullable<Message['file']>; isUserMessage?: boolean }) => {
    // Media dimensions constants
    const MEDIA_MAX_WIDTH = 350;
    const MEDIA_MAX_HEIGHT = 250;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageDimensions, setImageDimensions] = useState<{
      width: number;
      height: number;
    } | null>(null);

    // Video player hook - only create if video
    const player = useVideoPlayer(isVideo ? file.url : '', (player) => {
      player.pause();
    });

    const handleImageLoad = useCallback((event: { source: { width: number; height: number } }) => {
      const { width, height } = event.source;

      // Calculate dimensions to fit within max constraints while maintaining aspect ratio
      let displayWidth = width;
      let displayHeight = height;

      if (width > MEDIA_MAX_WIDTH || height > MEDIA_MAX_HEIGHT) {
        const widthRatio = MEDIA_MAX_WIDTH / width;
        const heightRatio = MEDIA_MAX_HEIGHT / height;
        const ratio = Math.min(widthRatio, heightRatio);

        displayWidth = width * ratio;
        displayHeight = height * ratio;
      }

      setImageDimensions({ width: displayWidth, height: displayHeight });
      setImageLoading(false);
    }, []);

    return (
      <View style={{ alignSelf: isUserMessage ? 'flex-end' : 'flex-start' }}>
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
              style={
                imageDimensions
                  ? {
                      width: imageDimensions.width,
                      height: imageDimensions.height,
                    }
                  : { width: MEDIA_MAX_WIDTH, height: 200 }
              }>
              {imageLoading && (
                <View
                  style={{
                    width: imageDimensions?.width || MEDIA_MAX_WIDTH,
                    height: imageDimensions?.height || 200,
                  }}
                  className="absolute inset-0 z-10 flex-col gap-2 rounded-lg bg-muted/30 p-3">
                  <Skeleton className="h-6 w-full rounded" />
                  <Skeleton className="h-6 w-[90%] rounded" />
                  <Skeleton className="h-6 w-full rounded" />
                  <Skeleton className="h-6 w-[70%] rounded" />
                </View>
              )}
              <Image
                source={{ uri: file.url }}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                className="rounded-lg"
                contentFit="contain"
                priority="high"
                cachePolicy="memory-disk"
                transition={300}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                onLoadStart={() => setImageLoading(true)}
                onLoad={handleImageLoad}
                onError={(e) => {
                  console.error('Image load error:', e.error);
                  setImageLoading(false);
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
      </View>
    );
  }
);

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isLoading = message.role === 'assistant' && !message.content;
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [copyStatus, setCopyStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleLongPress = useCallback(() => {
    if (!isLoading && message.content) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowContextMenu(true);
    }
  }, [isLoading, message.content]);

  const formatMessageContent = useCallback((content: string): string => {
    // Convert JSON code blocks to WhatsApp-friendly format
    // Matches ```json ... ``` or ``` ... ```
    const convertedContent = content.replace(
      /```(?:json)?\s*\n?([\s\S]*?)```/g,
      (_match, jsonContent) => {
        try {
          // Try to parse the JSON and convert to WhatsApp format
          const parsed = JSON.parse(jsonContent.trim());
          const whatsappFormatted = jsonToWhatsapp(parsed);
          return whatsappFormatted;
        } catch (e) {
          // If parsing fails, return the content without backticks
          return jsonContent.trim();
        }
      }
    );

    return markdownToWhatsapp(convertedContent);
  }, []);

  const handleCopyMessage = useCallback(async () => {
    try {
      const formattedText = formatMessageContent(message.content);
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
  }, [formatMessageContent, message.content]);

  const handleShareMessage = useCallback(async () => {
    try {
      const formattedText = formatMessageContent(message.content);
      await Share.share({
        message: formattedText,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowContextMenu(false);
    } catch (error) {
      console.error('Failed to share message:', error);
      setShowContextMenu(false);
    }
  }, [formatMessageContent, message.content]);

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
            {message.file && <FilePreview file={message.file} isUserMessage={isUser} />}
            {isLoading ? (
              <>
                {message.agentSteps && message.agentSteps.length > 0 ? (
                  <AgentStatus steps={message.agentSteps} />
                ) : (
                  <View className="p-3">
                    <TypingIndicator />
                  </View>
                )}
              </>
            ) : message.content ? (
              <View className="p-3">
                <MessageContent content={message.content} isUser={isUser} />
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
    </View>
  );
}

export default React.memo(ChatMessage);
