import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { Skeleton } from '@/components/ui/skeleton';

export default function PropertyListSkeleton() {
  return (
    <ScrollView className="flex-1 bg-light-background-alt">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="mt-4 px-4">
        <Skeleton className="mb-2 h-7 w-48" />
        <Skeleton className="mb-1 h-5 w-full" />
        <Skeleton className="mb-4 h-5 w-3/4" />
      </View>
      <View className="mt-4 px-4">
        <Skeleton className="h-24 w-full rounded-lg" />
      </View>
      {/* Property Card Skeletons */}
      <View className="mt-4 px-4">
        {[1, 2, 3].map((index) => (
          <View key={index} className="mb-4 rounded-lg bg-background p-4 shadow-sm">
            <View className="mb-4 flex-row items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <View className="flex-1">
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </View>
            </View>
            <View className="flex-row justify-around border-t border-border pt-4">
              <View className="items-center">
                <Skeleton className="mb-2 h-12 w-12 rounded-full" />
                <Skeleton className="mb-1 h-6 w-8" />
                <Skeleton className="h-3 w-12" />
              </View>
              <View className="items-center">
                <Skeleton className="mb-2 h-12 w-12 rounded-full" />
                <Skeleton className="mb-1 h-6 w-8" />
                <Skeleton className="h-3 w-16" />
              </View>
              <View className="items-center">
                <Skeleton className="mb-2 h-12 w-12 rounded-full" />
                <Skeleton className="mb-1 h-6 w-8" />
                <Skeleton className="h-3 w-14" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
