import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ScrollView, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import {
  ArrowLeft,
  Clock,
  Paperclip,
  Send,
  X,
  FileText,
  MapPin,
  Pencil,
  Upload,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProperties } from '@/contexts/PropertyContext';
import { useDocuments } from '@/contexts/DocumentContext';

function DetailsTab({ property }: { property: any }) {
  const { documents, loading: documentsLoading } = useDocuments();

  return (
    <View className="mb-4 w-full">
      <View className="mb-4 rounded-lg border border-gray-300 bg-background p-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon as={FileText} size={18} className="text-muted-foreground" />
            <Text className="text-foreground">Basic Information</Text>
          </View>
          <TouchableOpacity>
            <Icon as={Pencil} size={18} className="text-muted-foreground" />
          </TouchableOpacity>
        </View>
        <View className="space-y-4 border-t border-border pt-4">
          <View className="mb-2">
            <Text className="text-sm text-muted-foreground">Property Name</Text>
            <Text className="font-medium text-foreground">{property.name}</Text>
          </View>
          <View className="mb-2">
            <Text className="text-sm text-muted-foreground">Property Type</Text>
            <Text className="font-medium capitalize text-foreground">
              {property.propertyType || 'Not set'}
            </Text>
          </View>
          <View className="mb-2">
            <Text className="text-sm text-muted-foreground">Address</Text>
            <View className="flex-row items-center gap-1">
              <Icon as={MapPin} size={14} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">{property.address}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Property Documents Card */}
      <View className="rounded-lg border border-border bg-background p-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon as={FileText} size={18} className="text-muted-foreground" />
            <Text className="text-foreground">Property Documents</Text>
          </View>
          <TouchableOpacity className="flex-row items-center gap-2 rounded-md bg-primary px-3 py-2">
            <Icon as={Upload} size={16} className="text-primary-foreground" />
            <Text className="font-semibold text-primary-foreground">Upload</Text>
          </TouchableOpacity>
        </View>
        {documentsLoading ? (
          <ActivityIndicator />
        ) : (
          <View className="space-y-3 border-t border-border pt-4">
            {documents.map((doc) => (
              <View key={doc.id} className="mb-2 rounded-lg bg-secondary p-3">
                <View className="mb-3 flex-row items-start justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="rounded-md bg-red-100 p-2">
                      <Icon as={FileText} size={20} className="text-red-500" />
                    </View>
                    <View>
                      <Text className="font-semibold text-foreground">{doc.name}</Text>
                    </View>
                  </View>
                </View>
                <View className="space-y-2 border-t border-gray-100 pt-3">
                  {doc.keyEntities.map((entity, index) => (
                    <View key={index} className="flex-row justify-between">
                      <Text className="text-muted-foreground">{entity.name}</Text>
                      <Text className="font-semibold text-foreground">{entity.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function PropertyDetailsScreen() {
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { properties } = useProperties();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<'chat' | 'details'>('details');
  const [message, setMessage] = React.useState('');

  // Find the property with the matching ID
  const property = properties.find((p) => p.id === id);

  if (!property) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-foreground">Property not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 rounded-lg bg-primary px-4 py-2">
          <Text className="text-primary-foreground">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Navigation Header */}
      <View className="bg-background px-4 py-3">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2">
            <Icon as={ArrowLeft} size={24} className="text-foreground" />
            {/* <Text className="text-lg font-semibold text-foreground">property-details</Text> */}
          </TouchableOpacity>
          <View className="flex-row items-center gap-2">
            <Icon as={Clock} size={20} className="text-muted-foreground" />
            <Text className="text-muted-foreground">Sessions</Text>
          </View>
        </View>
      </View>

      {/* Property Address */}
      <View className="px-4 py-2">
        <Text className="text-xl font-bold text-foreground">{property.name}</Text>
        <Text className="text-muted-foreground">{property.address}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border px-4">
        <TouchableOpacity
          onPress={() => setActiveTab('chat')}
          className={`flex-1 py-3 ${activeTab === 'chat' ? 'border-b-2 border-primary' : ''}`}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'chat' ? 'text-primary' : 'text-muted-foreground'
            }`}>
            AI Chat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('details')}
          className={`flex-1 py-3 ${activeTab === 'details' ? 'border-b-2 border-primary' : ''}`}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'details' ? 'text-primary' : 'text-muted-foreground'
            }`}>
            Details
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <ScrollView className="flex-1 bg-background px-4 py-4">
        {activeTab === 'chat' ? (
          <View className="items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-200">
              <Icon as={Send} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-muted-foreground">
              Ask questions about this property's{'\n'}documents, services, and history
            </Text>
          </View>
        ) : (
          <DetailsTab property={property} />
        )}
      </ScrollView>

      {/* Bottom Input Bar */}
      {activeTab === 'chat' && (
        <View className="border-t border-border bg-background px-4 py-3">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity>
              <Icon as={Paperclip} size={20} className="text-muted-foreground" />
            </TouchableOpacity>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity className="rounded-lg bg-primary p-2">
              <Icon as={Send} size={20} className="text-primary-foreground" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
