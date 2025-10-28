import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import {
  ArrowLeft,
  MessageSquare,
  Paperclip,
  Send,
  FileText,
  MapPin,
  Pencil,
  Upload,
  X,
  File,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list';
import { useProperty } from '@homeapp/common/contexts/property';
import { useSession } from '@homeapp/common/contexts/session-context';
import { MessagesProvider, useMessages } from '@homeapp/common/contexts/messages-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import SessionsList from '@/components/SessionsList';
import ChatList from '@/components/ChatList';
import type { Session, Document } from '@homeapp/common/types';

function DetailsTab({ property }: { property: any }) {
  const { documents, isLoading: documentsLoading } = useProperty();

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
                  {doc.keyEntities?.map((entity, index) => (
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

function ChatTab({ sessionId }: { sessionId: string | null }) {
  const { messages, isLoading } = useMessages();

  if (!sessionId) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-muted-foreground">
          Select a session to start chatting
        </Text>
      </View>
    );
  }

  return <ChatList messages={messages} isLoading={isLoading} />;
}

export default function PropertyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { properties } = usePropertiesList();
  const { draftsByProperty } = useSession();
  const { documents } = useProperty();
  const { user } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<'chat' | 'details'>('chat');
  const [message, setMessage] = React.useState('');
  const [sessionsDrawerVisible, setSessionsDrawerVisible] = React.useState(false);
  const [documentsDrawerVisible, setDocumentsDrawerVisible] = React.useState(false);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = React.useState<Document[]>([]);
  const [isSending, setIsSending] = React.useState(false);

  // Auto-select draft session when property loads
  React.useEffect(() => {
    if (id && draftsByProperty[id] && !selectedSessionId) {
      setSelectedSessionId(draftsByProperty[id].id);
    }
  }, [id, draftsByProperty, selectedSessionId]);

  const handleSendMessage = React.useCallback(async () => {
    if (!user || !selectedSessionId || !message.trim() || isSending) return;

    setIsSending(true);
    try {
      // Check if this is a draft session and claim it
      const sessionRef = doc(db, 'users', user.uid, 'chats', selectedSessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (sessionDoc.exists() && sessionDoc.data().name === 'draft') {
        const newName = message.substring(0, 30) || 'New Chat';
        await updateDoc(sessionRef, {
          name: newName,
          propertyId: id,
        });
      }

      // Add user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chats', selectedSessionId, 'messages'), {
        role: 'user',
        content: message,
        createdAt: serverTimestamp(),
        ...(selectedDocuments.length > 0 && {
          documents: selectedDocuments.map((doc) => ({
            name: doc.name,
            type: doc.documentType || 'OTHER',
          })),
        }),
      });

      setMessage('');

      // TODO: Call the agent API to get response
      // For now, we just save the user message
      // The agent response would be added via streaming API similar to webapp
    } catch (error) {
      console.error('Error sending message:', error);
      // TODO: Show error toast/alert
    } finally {
      setIsSending(false);
    }
  }, [user, selectedSessionId, message, isSending, db, id, selectedDocuments]);

  const toggleDocumentSelection = (document: Document) => {
    setSelectedDocuments((prev) => {
      const isSelected = prev.some((doc) => doc.id === document.id);
      if (isSelected) {
        return prev.filter((doc) => doc.id !== document.id);
      } else {
        return [...prev, document];
      }
    });
  };

  // Find the property with the matching ID
  const property = properties.find((p: any) => p.id === id);

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
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Navigation Header */}
      <View className="bg-background px-4 py-3">
        <View className="flex-row items-center justify-between" style={{ minHeight: 40 }}>
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2">
            <Icon as={ArrowLeft} size={24} className="text-foreground" />
          </TouchableOpacity>
          <View className="flex-row items-center gap-3">
            {activeTab === 'chat' && (
              <>
                <TouchableOpacity
                  onPress={() => setDocumentsDrawerVisible(true)}
                  className="flex-row items-center gap-2 rounded-md bg-secondary px-3 py-2">
                  <Icon as={File} size={18} className="text-foreground" />
                  <Text className="text-foreground">Docs</Text>
                  {selectedDocuments.length > 0 && (
                    <View className="rounded-full bg-primary px-2 py-0.5">
                      <Text className="text-xs font-semibold text-primary-foreground">
                        {selectedDocuments.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSessionsDrawerVisible(true)}
                  className="flex-row items-center gap-2 rounded-md bg-secondary px-3 py-2">
                  <Icon as={MessageSquare} size={18} className="text-foreground" />
                  <Text className="text-foreground">Sessions</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Property Address */}
      <View className="px-4 py-2">
        <Text className="text-xl font-bold text-foreground">{property.name}</Text>
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

      {/* Selected Documents Display */}
      {activeTab === 'chat' && selectedDocuments.length > 0 && (
        <View className="border-b border-border bg-secondary px-4 py-2">
          <Text className="mb-2 text-xs font-semibold text-muted-foreground">Resources:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {selectedDocuments.map((doc) => (
                <View
                  key={doc.id}
                  className="flex-row items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
                  <Icon as={FileText} size={14} className="text-muted-foreground" />
                  <Text className="max-w-32 text-xs text-foreground" numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <TouchableOpacity onPress={() => toggleDocumentSelection(doc)}>
                    <Icon as={X} size={14} className="text-muted-foreground" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setSelectedDocuments([])}
                className="items-center justify-center rounded-full bg-background px-3 py-1.5">
                <Text className="text-xs text-muted-foreground">Clear all</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Main Content Area */}
      {activeTab === 'chat' ? (
        <MessagesProvider sessionId={selectedSessionId}>
          <ChatTab sessionId={selectedSessionId} />
        </MessagesProvider>
      ) : (
        <ScrollView className="flex-1 bg-background px-4 py-4">
          <DetailsTab property={property} />
        </ScrollView>
      )}

      {/* Bottom Input Bar */}
      {activeTab === 'chat' && selectedSessionId && (
        <View className="border-t border-border bg-background px-4 py-3">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity disabled>
              <Icon as={Paperclip} size={20} className="text-muted-foreground" />
            </TouchableOpacity>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border border-border bg-background px-3 text-foreground"
              placeholderTextColor="#9CA3AF"
              multiline
              style={{
                maxHeight: 50,
                paddingTop: 8,
                paddingBottom: 8,
                textAlignVertical: 'center',
              }}
              editable={!isSending}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity
              className={`rounded-lg p-2 ${
                message.trim() && !isSending ? 'bg-primary' : 'bg-secondary'
              }`}
              onPress={handleSendMessage}
              disabled={!message.trim() || isSending}>
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon
                  as={Send}
                  size={20}
                  className={message.trim() ? 'text-primary-foreground' : 'text-muted-foreground'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sessions Drawer */}
      <Modal
        visible={sessionsDrawerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSessionsDrawerVisible(false)}>
        <SafeAreaView className="flex-1 bg-background">
          <View className="border-b border-border bg-background px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground">Sessions</Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {property.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSessionsDrawerVisible(false)}
                className="ml-2 p-2">
                <Icon as={X} size={24} className="text-foreground" />
              </TouchableOpacity>
            </View>
          </View>
          <SessionsList
            propertyId={id}
            onSessionPress={(session: Session) => {
              setSelectedSessionId(session.id);
              setActiveTab('chat');
              setSessionsDrawerVisible(false);
            }}
            onCreateSession={() => {
              setActiveTab('chat');
              setSessionsDrawerVisible(false);
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* Documents Selection Drawer */}
      <Modal
        visible={documentsDrawerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDocumentsDrawerVisible(false)}>
        <SafeAreaView className="flex-1 bg-background">
          <View className="border-b border-border bg-background px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground">Select Resources</Text>
                <Text className="text-sm text-muted-foreground">
                  {selectedDocuments.length} selected
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDocumentsDrawerVisible(false)}
                className="ml-2 p-2">
                <Icon as={X} size={24} className="text-foreground" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView className="flex-1 px-4 py-4">
            {documents.length === 0 ? (
              <View className="items-center py-8">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <Icon as={FileText} size={32} className="text-muted-foreground" />
                </View>
                <Text className="text-center text-muted-foreground">
                  No documents available for this property.
                </Text>
              </View>
            ) : (
              <View className="space-y-3">
                {documents.map((document) => {
                  const isSelected = selectedDocuments.some((doc) => doc.id === document.id);
                  return (
                    <TouchableOpacity
                      key={document.id}
                      onPress={() => toggleDocumentSelection(document)}
                      className={`rounded-lg border p-4 ${
                        isSelected ? 'border-primary bg-blue-50' : 'border-border bg-background'
                      }`}>
                      <View className="flex-row items-start gap-3">
                        <View
                          className={`h-10 w-10 items-center justify-center rounded-full ${
                            isSelected ? 'bg-primary' : 'bg-secondary'
                          }`}>
                          <Icon
                            as={FileText}
                            size={20}
                            className={
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                            }
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-foreground">{document.name}</Text>
                          {document.documentType && (
                            <Text className="mt-1 text-xs capitalize text-muted-foreground">
                              {document.documentType.replace(/_/g, ' ').toLowerCase()}
                            </Text>
                          )}
                          {document.createdAt && (
                            <Text className="mt-1 text-xs text-muted-foreground">
                              {new Date(
                                document.createdAt instanceof Date
                                  ? document.createdAt
                                  : document.createdAt.toDate()
                              ).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        {isSelected && (
                          <View className="rounded-full bg-primary p-1">
                            <Icon as={X} size={16} className="text-primary-foreground" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
