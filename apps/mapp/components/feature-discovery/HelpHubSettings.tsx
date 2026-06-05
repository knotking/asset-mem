import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HELP_ARTICLES,
  hasDismissedFeatureTips,
  resolveDiscoveryProperty,
} from '@homeapp/common/lib/feature-discovery';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list-context';

export function HelpHubSettings() {
  const router = useRouter();
  const { properties } = usePropertiesList();
  const { preferences, resetFeatureTipsDismissed } = usePreferences();
  const [resettingTips, setResettingTips] = useState(false);
  const canResetTips = hasDismissedFeatureTips(preferences);
  const property = resolveDiscoveryProperty(properties, preferences);
  const propertyId = property?.id;

  const openProperty = (tab: 'chat' | 'timeline' | 'details') => {
    if (!propertyId) {
      router.replace('/(tabs)/home');
      return;
    }
    router.push({
      pathname: '/home/property-details',
      params: { id: propertyId, tab },
    });
  };

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <Icon as={BookOpen} size={20} className="text-foreground" />
          <CardTitle>How to use AssetMem AI</CardTitle>
        </View>
        <CardDescription>
          Short guides to checkpoints, chat modes, comparisons, and usage limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        {HELP_ARTICLES.map((article) => (
          <View key={article.id} className="rounded-lg border border-border bg-muted/30 p-3">
            <Text className="text-sm font-semibold text-foreground">{article.title}</Text>
            <Text className="mt-1 text-xs text-muted-foreground">{article.summary}</Text>
            {article.bullets.map((bullet) => (
              <Text key={bullet} className="mt-1 text-xs text-muted-foreground">
                • {bullet}
              </Text>
            ))}
          </View>
        ))}
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" size="sm" onPress={() => openProperty('timeline')}>
            <Text>Open Timeline</Text>
          </Button>
          <Button variant="outline" size="sm" onPress={() => openProperty('chat')}>
            <Text>Open AI Chat</Text>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => router.push('/(tabs)/settings/usage')}>
            <Text>AI usage</Text>
          </Button>
        </View>
        <View className="rounded-lg border border-dashed border-border p-3">
          <Text className="text-sm font-semibold text-foreground">Contextual tips</Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            Dismissed tips in chat, timeline, and property views stay hidden until you turn them
            back on.
          </Text>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={!canResetTips || resettingTips}
            onPress={async () => {
              setResettingTips(true);
              try {
                await resetFeatureTipsDismissed();
                Alert.alert(
                  'Tips restored',
                  'Contextual tips will show again when relevant.'
                );
              } catch {
                Alert.alert('Could not reset tips', 'Try again in a moment.');
              } finally {
                setResettingTips(false);
              }
            }}>
            <Text>{resettingTips ? 'Resetting…' : 'Show contextual tips again'}</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
