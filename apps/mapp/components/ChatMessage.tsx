import React from 'react';
import { View, Image, Linking, Pressable, Share, Modal, TouchableOpacity } from 'react-native';
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

const MessageAvatar = ({ role }: { role: 'user' | 'assistant' }) => {
  const isUser = role === 'user';
  return (
    <View
      className={`h-8 w-8 items-center justify-center rounded-full ${
        isUser ? 'bg-primary' : 'bg-secondary'
      }`}>
      <Icon
        as={isUser ? User : Bot}
        size={18}
        className={isUser ? 'text-primary-foreground' : 'text-secondary-foreground'}
      />
    </View>
  );
};

const ProductCard = ({ product }: { product: Product }) => {
  // Determine an image source: prefer explicit image_url
  const imageSrc = product.image_url || null;

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
          <Image
            source={{ uri: imageSrc }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
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
                <Icon as={Star} size={14} className="text-yellow-500" />
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
        <Button onPress={() => Linking.openURL(product.url!)} variant="outline" className="w-full">
          <Text>View Product</Text>
        </Button>
      )}
    </View>
  );
};

const YouTubeEmbed = ({ videoUrl }: { videoUrl: string }) => {
  // Extract video ID from YouTube URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = getYouTubeVideoId(videoUrl);

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
};

const ServiceProviderCard = ({ provider }: { provider: ServiceProvider }) => {
  const linkStr = typeof provider.link === 'string' ? provider.link : undefined;
  const websiteStr = typeof provider.website === 'string' ? provider.website : undefined;

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

  const primaryLink = normalizeUrl(linkStr) || normalizeUrl(websiteStr) || undefined;
  const isYelp = !!primaryLink && primaryLink.includes('yelp.com');
  const primaryLinkLabel = isYelp ? 'View on Yelp' : 'Website';

  const isPrimaryLinkValid = typeof primaryLink === 'string' && /^https?:\/\//i.test(primaryLink);
  const isDirectionsLinkValid =
    typeof provider.directions === 'string' &&
    (provider.directions.startsWith('http://') || provider.directions.startsWith('https://'));

  // Helper function to check if a value is meaningful
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
          <View className="ml-2 flex-row items-center gap-1 rounded-full bg-blue-100 px-2 py-1">
            <Icon as={CheckCircle} size={12} className="text-blue-800" />
            <Text className="text-xs text-blue-800">Authorized</Text>
          </View>
        )}
      </View>

      {(hasRating || hasReviews) && (
        <View className="mb-2 flex-row items-center gap-2">
          {hasRating && (
            <>
              <Icon as={Star} size={14} className="text-yellow-500" />
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
            <Icon as={Phone} size={14} className="text-muted-foreground" />
            <Text className="flex-1 text-sm text-foreground">{provider.contact_info}</Text>
          </View>
        )}
        {hasLocation && (
          <View className="flex-row items-center gap-2">
            <Icon as={Map} size={14} className="text-muted-foreground" />
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
            <Button
              onPress={() => Linking.openURL(primaryLink)}
              variant="outline"
              className="flex-1">
              <Text>{primaryLinkLabel}</Text>
            </Button>
          )}
          {isDirectionsLinkValid && provider.directions && (
            <Button
              onPress={() => Linking.openURL(provider.directions!)}
              variant="default"
              className="flex-1">
              <Text>Directions</Text>
            </Button>
          )}
        </View>
      )}
    </View>
  );
};

const StructuredResponse = ({ data }: { data: StructuredResponseData }) => {
  const markdownStyles = useMarkdownStyles(false);

  // Support both nested (analysis.*) and flat structures (top-level keys)
  const analysis = data.analysis || ({} as NonNullable<StructuredResponseData['analysis']>);
  const triage = analysis?.triageResult || (data as any)?.triageResult;
  const coverage = analysis?.coverageResult || (data as any)?.coverageResult;
  const diy = analysis?.diyResults || (data as any)?.diyResults;
  const service = analysis?.serviceResults || (data as any)?.serviceResults;

  // Normalize provider objects
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
    const additional_information =
      p.additional_information || p.description || p.about || undefined;
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

  const allProvidersRaw = [
    ...getProvidersArray(service?.localPros?.yelpAPIResults),
    ...getProvidersArray(service?.localPros?.serpAPIResults),
    ...getProvidersArray(service?.providers),
    ...getProvidersArray(service?.localProviders),
    ...getProvidersArray(service?.local_pros),
    ...getProvidersArray(service?.results),
    ...getProvidersArray(service?.nearbyProviders),
  ];

  const allProviders = allProvidersRaw
    .filter(providerHasValidData)
    .map(normalizeProvider)
    .filter(Boolean) as ServiceProvider[];

  const hasTriage = !!(
    triage?.diagnosis &&
    typeof triage.diagnosis === 'string' &&
    triage.diagnosis.trim() !== ''
  );
  const hasCoverage = !!(coverage && (coverage.warrantyInfo || coverage.insuranceInfo));
  const hasDIY = !!(
    diy &&
    (diy.diySteps?.summary ||
      (diy.diySteps?.steps && diy.diySteps.steps.length > 0) ||
      (diy.youtubeSearch?.videos && diy.youtubeSearch.videos.length > 0) ||
      (diy.recommendedProducts?.products && diy.recommendedProducts.products.length > 0))
  );
  const hasService = allProviders.length > 0;

  return (
    <Accordion type="single" collapsible defaultValue="triage" className="w-full">
      {hasTriage && (
        <AccordionItem value="triage" className="border-b border-border">
          <AccordionTrigger className="px-2 py-3">
            <View className="flex-row items-center gap-2">
              <Icon as={Info} size={16} className="text-blue-600" />
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
              <Icon as={ShieldCheck} size={16} className="text-green-600" />
              <Text className="font-medium text-foreground">Coverage Analysis</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-background p-4">
            {coverage?.warrantyInfo && (
              <View className="mb-3">
                <Text className="mb-1 text-sm font-semibold text-green-700">
                  Warranty Information
                </Text>
                <Markdown style={markdownStyles} rules={markdownRules}>
                  {coverage.warrantyInfo}
                </Markdown>
              </View>
            )}
            {coverage?.insuranceInfo && (
              <View>
                <Text className="mb-1 text-sm font-semibold text-green-700">
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
              <Icon as={Wrench} size={16} className="text-orange-600" />
              <Text className="font-medium text-foreground">DIY Recommendations</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-background p-4">
            {diy?.diySteps?.summary && (
              <View className="mb-3">
                <Text className="mb-1 text-sm font-semibold text-orange-700">Summary</Text>
                <Markdown style={markdownStyles} rules={markdownRules}>
                  {diy.diySteps.summary}
                </Markdown>
              </View>
            )}

            {diy?.diySteps?.steps && diy.diySteps.steps.length > 0 && (
              <View className="mb-3">
                <Text className="mb-2 text-sm font-semibold text-orange-700">
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
                <Text className="mb-2 text-sm font-semibold text-orange-700">Video Tutorials</Text>
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
                <Text className="mb-2 text-sm font-semibold text-orange-700">
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
              <Icon as={Users} size={16} className="text-purple-600" />
              <Text className="font-medium text-foreground">Service Recommendations</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-background p-4">
            <Text className="mb-2 text-sm font-semibold text-purple-700">
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
};

const MessageContent = ({ content, isUser }: { content: string; isUser: boolean }) => {
  const markdownStyles = useMarkdownStyles(isUser);

  // Try to parse structured JSON response (assistant only)
  let structuredData: StructuredResponseData | null = null;
  let plainContent = content;

  if (!isUser && content) {
    try {
      const contentToParse = content.trim();

      // Helper function to check if parsed JSON has structured data keys
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

      // Single parsing method: Extract JSON from markdown code block or parse directly
      const jsonMatch = contentToParse.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : contentToParse.trim();

      try {
        const parsed = JSON.parse(jsonStr);
        if (hasStructuredDataKeys(parsed)) {
          structuredData = parsed;
          // Remove the markdown wrapper from plain content if it existed
          plainContent = jsonMatch ? contentToParse.replace(jsonMatch[0], '').trim() : '';
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

  if (structuredData) {
    return (
      <View className="w-full">
        {plainContent && (
          <Markdown style={markdownStyles} rules={markdownRules}>
            {plainContent}
          </Markdown>
        )}
        <StructuredResponse data={structuredData} />
      </View>
    );
  }

  // Render content with markdown support
  return (
    <Markdown style={markdownStyles} rules={markdownRules}>
      {content}
    </Markdown>
  );
};

const FilePreview = ({ file }: { file: NonNullable<Message['file']> }) => {
  // Media dimensions constants
  const MEDIA_MAX_WIDTH = 350;
  const MEDIA_FIXED_HEIGHT = 192;

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const [imageError, setImageError] = React.useState(false);
  const [imageDimensions, setImageDimensions] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoReady, setVideoReady] = React.useState(false);

  // Video player hook - only create if video
  const player = useVideoPlayer(isVideo ? file.url : '', (player) => {
    player.pause();
  });

  React.useEffect(() => {
    if (isVideo && player) {
      // Set video as ready when player status changes
      const checkStatus = () => {
        if (player.status === 'readyToPlay' || player.status === 'idle') {
          setVideoReady(true);
        }
      };

      // Check immediately
      checkStatus();

      // Set a timeout fallback to show video after 2 seconds regardless
      const timeout = setTimeout(() => {
        setVideoReady(true);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [isVideo, player]);

  React.useEffect(() => {
    if (isImage && file.url) {
      Image.getSize(
        file.url,
        (width, height) => {
          // Calculate width based on aspect ratio while maintaining fixed height
          const aspectRatio = width / height;
          let displayWidth = MEDIA_FIXED_HEIGHT * aspectRatio;
          let displayHeight = MEDIA_FIXED_HEIGHT;

          // If calculated width exceeds max, scale down both dimensions
          if (displayWidth > MEDIA_MAX_WIDTH) {
            displayWidth = MEDIA_MAX_WIDTH;
            displayHeight = MEDIA_MAX_WIDTH / aspectRatio;
          }

          setImageDimensions({ width: displayWidth, height: displayHeight });
        },
        (error) => {
          console.error('Failed to get image size:', error);
          setImageError(true);
        }
      );
    }
  }, [isImage, file.url]);

  return (
    <View>
      {isImage ? (
        imageError ? (
          <View className="flex-row items-center gap-2 rounded-lg border border-border bg-secondary p-3">
            <Icon as={FileText} size={20} className="text-muted-foreground" />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                {file.name}
              </Text>
              <Text className="text-xs text-red-500">Failed to load image</Text>
            </View>
          </View>
        ) : imageDimensions ? (
          <Image
            source={{ uri: file.url }}
            style={{
              width: imageDimensions.width,
              height: imageDimensions.height,
              borderRadius: 8,
            }}
            resizeMode="contain"
            onError={(e) => {
              console.error('Image load error:', e.nativeEvent.error);
              setImageError(true);
            }}
          />
        ) : (
          <View
            style={{ width: MEDIA_MAX_WIDTH, height: MEDIA_FIXED_HEIGHT }}
            className="flex-col gap-2 rounded-lg bg-muted/30 p-3">
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-[90%] rounded" />
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-[70%] rounded" />
          </View>
        )
      ) : isVideo ? (
        videoReady ? (
          <View className="overflow-hidden rounded-lg">
            <VideoView
              player={player}
              style={{ width: MEDIA_MAX_WIDTH, height: MEDIA_FIXED_HEIGHT }}
              contentFit="contain"
              allowsFullscreen
              allowsPictureInPicture
            />
          </View>
        ) : (
          <View
            style={{ width: MEDIA_MAX_WIDTH, height: MEDIA_FIXED_HEIGHT }}
            className="flex-col gap-2 rounded-lg bg-muted/30 p-3">
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-[90%] rounded" />
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-[70%] rounded" />
          </View>
        )
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
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isLoading = message.role === 'assistant' && !message.content;
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleLongPress = () => {
    if (!isLoading && message.content) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowContextMenu(true);
    }
  };

  const formatMessageContent = (content: string): string => {
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
  };

  const handleCopyMessage = async () => {
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
  };

  const handleShareMessage = async () => {
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
  };

  return (
    <View className={`mb-4 flex-row gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <View className="hidden md:flex">
        <MessageAvatar role={message.role} />
      </View>
      <View className={`flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <Pressable onLongPress={handleLongPress} delayLongPress={500}>
          <View
            className={`overflow-hidden rounded-lg ${isUser ? 'bg-gray-200 dark:bg-gray-800' : 'bg-secondary'}`}>
            {message.file && <FilePreview file={message.file} />}
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
        onRequestClose={() => setShowContextMenu(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowContextMenu(false)}
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
