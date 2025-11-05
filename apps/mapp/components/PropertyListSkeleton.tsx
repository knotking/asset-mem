import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { Skeleton } from '@/components/ui/skeleton';

export default function PropertyListSkeleton() {
  return (
    <ScrollView className="flex-1 bg-secondary">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header Section */}
      <View className="gap-2 px-4 pt-4">
        <Skeleton className="h-6 w-48 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </View>
      {/* Search/Filter Section */}
      <View className="px-4 pt-6">
        <Skeleton className="h-24 w-full rounded-lg" />
      </View>
      {/* Property Card Skeletons */}
      <View className="gap-4 px-4 pt-6">
        {[1, 2, 3].map((index) => (
          <View key={index} className="rounded-lg bg-card p-4 shadow-sm">
            <View className="mb-4 flex-row items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <View className="flex-1 gap-2">
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
              </View>
            </View>
            <View className="flex-row justify-around border-t border-border pt-4">
              <View className="items-center gap-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-5 w-8 rounded-md" />
                <Skeleton className="h-3 w-12 rounded-md" />
              </View>
              <View className="items-center gap-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-5 w-8 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </View>
              <View className="items-center gap-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-5 w-8 rounded-md" />
                <Skeleton className="h-3 w-14 rounded-md" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
