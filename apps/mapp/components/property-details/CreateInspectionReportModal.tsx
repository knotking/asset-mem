import * as React from 'react';
import { Modal, View, Pressable, ScrollView, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, FileText, Upload, Loader2, Calendar as CalendarIcon } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

interface CreateInspectionReportModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    assetType: 'real_estate' | 'vehicle' | 'appliance' | 'other';
    location: string;
    documentType: 'home_inspection' | 'vehicle_inspection' | 'appliance_maintenance' | 'contractor_assessment' | 'other';
    inspectorName?: string;
    inspectionDate?: Date;
    document: DocumentPicker.DocumentPickerAsset;
  }) => Promise<void>;
}

const ASSET_TYPES = [
  { label: 'Real Estate', value: 'real_estate' as const },
  { label: 'Vehicle', value: 'vehicle' as const },
  { label: 'Appliance', value: 'appliance' as const },
  { label: 'Other', value: 'other' as const },
];

const REPORT_TYPES = {
  real_estate: [
    { label: 'Home Inspection', value: 'home_inspection' as const },
    { label: 'Contractor Assessment', value: 'contractor_assessment' as const },
    { label: 'Other', value: 'other' as const },
  ],
  vehicle: [
    { label: 'Vehicle Inspection', value: 'vehicle_inspection' as const },
    { label: 'Other', value: 'other' as const },
  ],
  appliance: [
    { label: 'Appliance Maintenance', value: 'appliance_maintenance' as const },
    { label: 'Other', value: 'other' as const },
  ],
  other: [
    { label: 'Other', value: 'other' as const },
  ],
};

const LOCATION_OPTIONS = {
  real_estate: [
    { label: 'Kitchen', value: 'Kitchen' },
    { label: 'Bathroom', value: 'Bathroom' },
    { label: 'Living Room', value: 'Living Room' },
    { label: 'Bedroom', value: 'Bedroom' },
    { label: 'Exterior', value: 'Exterior' },
    { label: 'Basement', value: 'Basement' },
    { label: 'Attic', value: 'Attic' },
    { label: 'Roof', value: 'Roof' },
    { label: 'Foundation', value: 'Foundation' },
    { label: 'HVAC System', value: 'HVAC System' },
    { label: 'Plumbing', value: 'Plumbing' },
    { label: 'Electrical', value: 'Electrical' },
    { label: 'Whole Property', value: 'Whole Property' },
    { label: 'Other', value: 'Other' },
  ],
  vehicle: [
    { label: 'Exterior', value: 'Exterior' },
    { label: 'Interior', value: 'Interior' },
    { label: 'Engine Bay', value: 'Engine Bay' },
    { label: 'Tires/Wheels', value: 'Tires/Wheels' },
    { label: 'Undercarriage', value: 'Undercarriage' },
    { label: 'Full Vehicle', value: 'Full Vehicle' },
    { label: 'Other', value: 'Other' },
  ],
  appliance: [
    { label: 'Exterior', value: 'Exterior' },
    { label: 'Interior', value: 'Interior' },
    { label: 'Controls', value: 'Controls' },
    { label: 'Full Appliance', value: 'Full Appliance' },
    { label: 'Other', value: 'Other' },
  ],
  other: [
    { label: 'Other', value: 'Other' },
  ],
};

export function CreateInspectionReportModal({ visible, onClose, onCreate }: CreateInspectionReportModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = React.useState('');
  const [assetType, setAssetType] = React.useState<'real_estate' | 'vehicle' | 'appliance' | 'other'>('real_estate');
  const [location, setLocation] = React.useState<string>('');
  const [customLocation, setCustomLocation] = React.useState<string>('');
  const [useCustomLocation, setUseCustomLocation] = React.useState(false);
  const [documentType, setDocumentType] = React.useState<'home_inspection' | 'vehicle_inspection' | 'appliance_maintenance' | 'contractor_assessment' | 'other'>('home_inspection');
  const [inspectorName, setInspectorName] = React.useState('');
  const [inspectionDate, setInspectionDate] = React.useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [document, setDocument] = React.useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = React.useState(false);

  const applyAutoDefaults = React.useCallback(() => {
    if (!name.trim() && document) {
      const effectiveLocation = useCustomLocation ? customLocation : location;
      const base = effectiveLocation?.trim() || 'Inspection Report';
      setName(`${base} • ${format(new Date(), 'MMM d')}`);
    }
  }, [name, location, customLocation, useCustomLocation, document]);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      setName('');
      setAssetType('real_estate');
      setLocation('');
      setCustomLocation('');
      setUseCustomLocation(false);
      setDocumentType('home_inspection');
      setInspectorName('');
      setInspectionDate(undefined);
      setDocument(null);
      setLoading(false);
    }
  }, [visible]);

  // Update document type when asset type changes
  React.useEffect(() => {
    const reportTypes = REPORT_TYPES[assetType];
    if (reportTypes && reportTypes.length > 0) {
      setDocumentType(reportTypes[0].value);
    }
  }, [assetType]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDocument(result.assets[0]);
        applyAutoDefaults();
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setInspectionDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!document) {
      return;
    }

    try {
      setLoading(true);
      const effectiveLocation = useCustomLocation ? customLocation : location;
      const finalName =
        name.trim() || `${(effectiveLocation || 'Inspection Report').trim()} • ${format(new Date(), 'MMM d')}`;
      const finalLocation = effectiveLocation.trim() || 'Whole Property';
      
      await onCreate({
        name: finalName,
        assetType,
        location: finalLocation,
        documentType,
        inspectorName: inspectorName.trim() || undefined,
        inspectionDate,
        document,
      });
    } catch (error) {
      console.error('Error creating inspection report checkpoint:', error);
      alert('Failed to create inspection report. Please try again.');
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Upload Inspection Report</Text>
          <Button onPress={onClose} variant="ghost" size="icon" disabled={loading}>
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Document Section */}
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-foreground">Report Document</Text>
            <View className="mb-4 min-h-32 overflow-hidden rounded-lg border border-border bg-muted p-4">
              {document ? (
                <View className="items-center">
                  <Icon as={FileText} size={48} className="mb-2 text-primary" />
                  <Text className="text-center text-sm font-medium text-foreground" numberOfLines={2}>
                    {document.name}
                  </Text>
                  {document.size && (
                    <Text className="mt-1 text-xs text-muted-foreground">
                      {formatFileSize(document.size)}
                    </Text>
                  )}
                  <Button
                    onPress={handlePickDocument}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="mt-3">
                    <Text className="text-xs text-foreground">Change Document</Text>
                  </Button>
                </View>
              ) : (
                <View className="items-center justify-center">
                  <Icon as={Upload} size={48} className="mb-2 text-muted-foreground opacity-50" />
                  <Text className="mb-3 text-center text-sm text-muted-foreground">
                    No document selected
                  </Text>
                  <Button onPress={handlePickDocument} disabled={loading}>
                    <View className="flex-row items-center gap-2">
                      <Icon as={FileText} size={16} className="text-primary-foreground" />
                      <Text className="text-primary-foreground">Select Document</Text>
                    </View>
                  </Button>
                </View>
              )}
            </View>
            <Text className="text-xs text-muted-foreground">
              Supported: PDF, images (JPG, PNG), Word documents
            </Text>
          </View>

          {/* Form Section */}
          <View className="gap-4">
            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Checkpoint Name</Text>
              <Input placeholder="e.g., Annual Home Inspection 2025" value={name} onChangeText={setName} />
              <Text className="mt-1 text-xs text-muted-foreground">
                Leave blank to auto-generate.
              </Text>
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Asset Type</Text>
              <Select
                value={{ value: assetType, label: ASSET_TYPES.find(t => t.value === assetType)?.label || 'Real Estate' }}
                onValueChange={(option) => {
                  if (option?.value) {
                    setAssetType(option.value);
                    setLocation('');
                  }
                }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type.value} label={type.label} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Report Type</Text>
              <Select
                value={{ value: documentType, label: REPORT_TYPES[assetType].find(t => t.value === documentType)?.label || 'Other' }}
                onValueChange={(option) => {
                  if (option?.value) {
                    setDocumentType(option.value as any);
                  }
                }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REPORT_TYPES[assetType].map((type) => (
                      <SelectItem key={type.value} label={type.label} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </View>

            <View>
              <Text className="mb-3 text-sm font-medium text-foreground">Location</Text>
              
              <View className="mb-3 flex-row gap-2">
                <Pressable
                  onPress={() => setUseCustomLocation(false)}
                  className={`flex-1 items-center rounded-lg border px-3 py-2 ${
                    !useCustomLocation ? 'border-primary bg-primary/10' : 'border-border bg-secondary'
                  }`}>
                  <Text
                    className={`text-xs font-medium ${
                      !useCustomLocation ? 'text-primary' : 'text-foreground'
                    }`}>
                    Preset Options
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setUseCustomLocation(true)}
                  className={`flex-1 items-center rounded-lg border px-3 py-2 ${
                    useCustomLocation ? 'border-primary bg-primary/10' : 'border-border bg-secondary'
                  }`}>
                  <Text
                    className={`text-xs font-medium ${
                      useCustomLocation ? 'text-primary' : 'text-foreground'
                    }`}>
                    Custom Location
                  </Text>
                </Pressable>
              </View>

              {useCustomLocation ? (
                <Input
                  placeholder="Enter custom location..."
                  value={customLocation}
                  onChangeText={setCustomLocation}
                />
              ) : (
                <Select
                  value={location ? { value: location, label: location } : undefined}
                  onValueChange={(option) => {
                    if (option?.value) {
                      setLocation(option.value);
                    }
                  }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select location (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {LOCATION_OPTIONS[assetType].map((loc) => (
                        <SelectItem key={loc.value} label={loc.label} value={loc.value}>
                          {loc.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Inspector Name (Optional)</Text>
              <Input
                placeholder="e.g., John Smith, ABC Inspections"
                value={inspectorName}
                onChangeText={setInspectorName}
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Inspection Date (Optional)</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="flex-row items-center gap-2 rounded-lg border border-border bg-background px-3 py-3">
                <Icon as={CalendarIcon} size={16} className="text-muted-foreground" />
                <Text className="flex-1 text-foreground">
                  {inspectionDate ? format(inspectionDate, 'MMM d, yyyy') : 'Select date'}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={inspectionDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View
          className="border-t border-border px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 4) }}>
          <Button onPress={handleSubmit} disabled={!document || loading} className="w-full">
            {loading ? (
              <View className="flex-row items-center gap-2">
                <Icon as={Loader2} size={16} className="animate-spin text-primary-foreground" />
                <Text className="text-primary-foreground">Creating...</Text>
              </View>
            ) : (
              <Text className="text-primary-foreground">Create Checkpoint</Text>
            )}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

