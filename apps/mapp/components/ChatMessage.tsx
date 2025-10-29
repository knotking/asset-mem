import React from 'react';
import { View, Image, TouchableOpacity, Linking } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  User,
  Bot,
  FileText,
  Home,
  ShieldCheck,
  Receipt,
  Search,
  FileKey,
  Info,
  Wrench,
  Users,
  Phone,
  Map,
  Star,
  CheckCircle,
} from 'lucide-react-native';
import type { Message, StructuredResponseData, ServiceProvider } from '@homeapp/common/types';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import Markdown from 'react-native-markdown-display';
import { useMarkdownStyles, markdownRules } from '@/lib/markdown-styles';
import TypingIndicator from './TypingIndicator';
import { AgentStatus } from './AgentStatus';

interface ChatMessageProps {
  message: Message;
}

const docTypeIcons = {
  DEED: Home,
  INSURANCE_POLICY: ShieldCheck,
  UTILITY_BILL: Receipt,
  INSPECTION_REPORT: Search,
  MORTGAGE_STATEMENT: FileKey,
  OTHER: FileText,
};

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

const ServiceProviderCard = ({ provider }: { provider: ServiceProvider }) => {
  const isPrimaryLinkValid =
    provider.link && (provider.link.startsWith('http://') || provider.link.startsWith('https://'));
  const isDirectionsLinkValid =
    provider.directions &&
    (provider.directions.startsWith('http://') || provider.directions.startsWith('https://'));

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

      <View className="mb-2 flex-row items-center gap-2">
        <Icon as={Star} size={14} className="text-yellow-500" />
        <Text className="text-sm text-foreground">{provider.ratings?.split('/')[0] || 'N/A'}</Text>
        <Text className="text-xs text-muted-foreground">
          (
          {provider.reviews && !provider.reviews.toLowerCase().includes('review')
            ? provider.reviews
            : `${provider.reviews || '0'} reviews`}
          )
        </Text>
      </View>

      <Text className="mb-2 text-sm text-muted-foreground" numberOfLines={3}>
        {provider.additional_information || 'No additional information available.'}
      </Text>

      <View className="mb-2 space-y-1">
        <View className="flex-row items-center gap-2">
          <Icon as={Phone} size={14} className="text-muted-foreground" />
          <Text className="flex-1 text-sm text-foreground">
            {provider.contact_info || 'Not available'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Icon as={Map} size={14} className="text-muted-foreground" />
          <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
            {provider.location || 'Not available'}
          </Text>
        </View>
      </View>

      {provider.specialties && (
        <View className="mb-2">
          <Text className="text-xs font-semibold text-muted-foreground">Specialties</Text>
          <Text className="text-xs text-foreground">{provider.specialties}</Text>
        </View>
      )}

      <View className="flex-row gap-2">
        {isPrimaryLinkValid && (
          <TouchableOpacity
            onPress={() => Linking.openURL(provider.link!)}
            className="flex-1 rounded-md border border-border bg-secondary px-3 py-2">
            <Text className="text-center text-sm font-medium text-foreground">
              {provider.link?.includes('yelp.com') ? 'View on Yelp' : 'Website'}
            </Text>
          </TouchableOpacity>
        )}
        {isDirectionsLinkValid && (
          <TouchableOpacity
            onPress={() => Linking.openURL(provider.directions!)}
            className="flex-1 rounded-md bg-primary px-3 py-2">
            <Text className="text-center text-sm font-medium text-primary-foreground">
              Directions
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const StructuredResponse = ({ data }: { data: StructuredResponseData }) => {
  const markdownStyles = useMarkdownStyles(false);
  const allProviders = [
    ...(data.serviceProviderResults?.yelpAPIResults || []),
    ...(data.serviceProviderResults?.serpAPIResults || []),
  ];

  const hasContent = (key: keyof NonNullable<StructuredResponseData['researchResults']>) =>
    data.researchResults?.[key] && data.researchResults[key]?.trim() !== '';

  const hasProviders = allProviders.length > 0;

  return (
    <Accordion type="single" collapsible defaultValue="summary" className="w-full">
      {hasContent('summaryOfFindings') && (
        <AccordionItem value="summary">
          <AccordionTrigger className="px-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon as={Info} size={16} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">Summary</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="rounded-b-lg border-t border-border bg-background p-4">
            <Markdown style={markdownStyles} rules={markdownRules}>
              {data.researchResults!.summaryOfFindings!}
            </Markdown>
          </AccordionContent>
        </AccordionItem>
      )}

      {hasContent('yourDocuments') && (
        <AccordionItem value="coverage">
          <AccordionTrigger className="px-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon as={ShieldCheck} size={16} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">Coverage</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="rounded-b-lg border-t border-border bg-background p-4">
            <Markdown style={markdownStyles} rules={markdownRules}>
              {data.researchResults!.yourDocuments!}
            </Markdown>
          </AccordionContent>
        </AccordionItem>
      )}

      {(hasContent('googleSearch') || hasContent('youtubeSearch')) && (
        <AccordionItem value="diy">
          <AccordionTrigger className="px-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon as={Wrench} size={16} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">DIY Solutions</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="rounded-b-lg border-t border-border bg-background p-4">
            {hasContent('googleSearch') && (
              <View className="mb-3">
                <Markdown style={markdownStyles} rules={markdownRules}>
                  {data.researchResults!.googleSearch!}
                </Markdown>
              </View>
            )}
            {hasContent('youtubeSearch') && (
              <Markdown style={markdownStyles} rules={markdownRules}>
                {data.researchResults!.youtubeSearch!}
              </Markdown>
            )}
          </AccordionContent>
        </AccordionItem>
      )}

      {hasProviders && (
        <AccordionItem value="providers">
          <AccordionTrigger className="px-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon as={Users} size={16} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">Service Providers</Text>
            </View>
          </AccordionTrigger>
          <AccordionContent className="rounded-b-lg border-t border-border bg-background p-4">
            {allProviders.map((provider, index) => (
              <ServiceProviderCard key={index} provider={provider} />
            ))}
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
      const jsonRegex = /\*\*.*?\*\*\s*:\s*```json\s*\n([\s\S]*?)```/;
      const match = content.match(jsonRegex);

      if (match && match[1]) {
        // Clean up markdown which has unescaped characters
        const cleaned = match[1].trim().replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
        const parsed = JSON.parse(cleaned);
        if (parsed.researchResults || parsed.serviceProviderResults) {
          structuredData = parsed;
          // Remove the JSON block from plain content
          plainContent = content.replace(jsonRegex, '').trim();
        }
      }
    } catch (e) {
      console.log('Failed to parse structured data:', e);
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
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const [imageError, setImageError] = React.useState(false);
  const [imageDimensions, setImageDimensions] = React.useState<{ width: number; height: number } | null>(null);

  // Video player hook - only create if video
  const player = useVideoPlayer(isVideo ? file.url : '', (player) => {
    player.pause();
  });

  React.useEffect(() => {
    if (isImage && file.url) {
      Image.getSize(
        file.url,
        (width, height) => {
          // Calculate aspect ratio and set dimensions
          // Max width is screen width minus padding, let's assume 350px
          const maxWidth = 350;
          const maxHeight = 400;

          let displayWidth = width;
          let displayHeight = height;

          // Scale down if image is too wide
          if (width > maxWidth) {
            const ratio = maxWidth / width;
            displayWidth = maxWidth;
            displayHeight = height * ratio;
          }

          // Scale down if image is too tall
          if (displayHeight > maxHeight) {
            const ratio = maxHeight / displayHeight;
            displayWidth = displayWidth * ratio;
            displayHeight = maxHeight;
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
    <View className="mb-2 overflow-hidden rounded-lg border border-border bg-secondary/30">
      {isImage ? (
        imageError ? (
          <View className="flex-row items-center gap-2 bg-secondary p-3">
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
            style={{ width: imageDimensions.width, height: imageDimensions.height }}
            resizeMode="contain"
            onError={(e) => {
              console.error('Image load error:', e.nativeEvent.error);
              setImageError(true);
            }}
          />
        ) : (
          <View className="h-48 w-full items-center justify-center">
            <Text className="text-sm text-muted-foreground">Loading image...</Text>
          </View>
        )
      ) : isVideo ? (
        <VideoView
          player={player}
          style={{ width: 350, height: 300 }}
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture
        />
      ) : (
        <View className="flex-row items-center gap-2 bg-secondary p-3">
          <Icon as={FileText} size={20} className="text-muted-foreground" />
          <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
            {file.name}
          </Text>
        </View>
      )}
    </View>
  );
};

const DocumentsList = ({ documents }: { documents: NonNullable<Message['documents']> }) => {
  return (
    <View className="mb-2 space-y-2">
      <Text className="text-xs font-semibold text-muted-foreground">Context Documents:</Text>
      {documents.map((doc, index) => {
        const IconComponent = docTypeIcons[doc.type] || FileText;
        return (
          <View key={index} className="flex-row items-center gap-2 rounded-md bg-secondary p-2">
            <Icon as={IconComponent} size={16} className="text-muted-foreground" />
            <Text className="flex-1 text-xs text-foreground" numberOfLines={1}>
              {doc.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isLoading = message.role === 'assistant' && !message.content;

  return (
    <View className={`mb-4 flex-row gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <View className="hidden md:flex">
        <MessageAvatar role={message.role} />
      </View>
      <View className={`flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <View className={`rounded-lg p-3 ${isUser ? 'bg-primary' : 'bg-secondary'}`}>
          {message.file && <FilePreview file={message.file} />}
          {message.documents && message.documents.length > 0 && (
            <DocumentsList documents={message.documents} />
          )}
          {isLoading ? (
            <>
              {message.agentSteps && message.agentSteps.length > 0 ? (
                <AgentStatus steps={message.agentSteps} />
              ) : (
                <TypingIndicator />
              )}
            </>
          ) : (
            <MessageContent content={message.content} isUser={isUser} />
          )}
        </View>
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
    </View>
  );
}
