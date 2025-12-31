# Reports Feature - Frontend Integration Guide

## Overview

This guide covers integrating the Reports feature into your web and mobile applications using the provided components and contexts.

## Web Application (React/Next.js)

### 1. Setup Context Provider

Add the `ReportsProvider` to your app layout:

**File**: `app/layout.tsx` or `app/providers.tsx`

```tsx
import { ReportsProvider } from '@/contexts/reports-context';
import { PropertyProvider } from '@/contexts/property-context';
import { AuthProvider } from '@/contexts/auth-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PropertyProvider>
        <ReportsProvider>
          {children}
        </ReportsProvider>
      </PropertyProvider>
    </AuthProvider>
  );
}
```

**Important**: `ReportsProvider` must be nested inside `PropertyProvider` and `AuthProvider` as it depends on both.

### 2. Add Reports Tab to Property Page

**File**: `app/properties/[propertyId]/page.tsx`

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyReportsTab } from '@/components/properties/property-reports-tab';
import { PropertyDetailsTab } from '@/components/properties/property-details-tab';
import { PropertyCheckpointsTab } from '@/components/properties/property-checkpoints-tab';

export default function PropertyPage() {
  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      
      <TabsContent value="details">
        <PropertyDetailsTab />
      </TabsContent>
      
      <TabsContent value="documents">
        {/* Documents content */}
      </TabsContent>
      
      <TabsContent value="checkpoints">
        <PropertyCheckpointsTab />
      </TabsContent>
      
      <TabsContent value="reports">
        <PropertyReportsTab />
      </TabsContent>
    </Tabs>
  );
}
```

### 3. Using the Reports Context

Access reports data and functions from any component:

```tsx
'use client';

import { useReports } from '@/contexts/reports-context';

export function MyComponent() {
  const {
    reports,              // Array of InspectionReport
    loading,              // Boolean
    selectedReport,       // InspectionReport | null
    setSelectedReport,    // Function
    uploadReport,         // Function
    chatWithReport,       // Function
  } = useReports();

  // Upload a report
  const handleUpload = async (file: File) => {
    try {
      const reportId = await uploadReport(file, 'HOME_INSPECTION');
      console.log('Uploaded:', reportId);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  // Ask a question
  const handleQuestion = async (question: string) => {
    if (!selectedReport) return;
    try {
      const answer = await chatWithReport(selectedReport.id, question);
      console.log('Answer:', answer);
    } catch (error) {
      console.error('Chat failed:', error);
    }
  };

  return (
    <div>
      <p>Total Reports: {reports.length}</p>
      <p>Loading: {loading ? 'Yes' : 'No'}</p>
      {/* Your UI */}
    </div>
  );
}
```

### 4. Custom Upload Button

Create a custom upload trigger:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadReportsDialog } from '@/components/properties/upload-reports-dialog';
import { Upload } from 'lucide-react';

export function CustomUploadButton() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Upload Inspection Report
      </Button>
      
      <UploadReportsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
```

### 5. Display Report Card

Create a custom report card component:

```tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FileText, AlertTriangle } from 'lucide-react';
import type { InspectionReport } from '@/lib/types';

interface ReportCardProps {
  report: InspectionReport;
  onClick: () => void;
}

export function ReportCard({ report, onClick }: ReportCardProps) {
  const { aiAnalysis } = report;
  const criticalCount = aiAnalysis?.issues?.filter(
    issue => typeof issue === 'object' && issue.severity === 'critical'
  ).length || 0;

  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="font-semibold">{report.name}</h3>
          </div>
          <Badge>{report.status}</Badge>
        </div>
      </CardHeader>
      
      {report.status === 'complete' && aiAnalysis && (
        <CardContent>
          <p className="text-sm text-gray-600 mb-2">
            Condition: <span className="font-semibold capitalize">
              {aiAnalysis.overallCondition}
            </span>
          </p>
          
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                {criticalCount} Critical Issue{criticalCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
```

### 6. Listening to Real-time Updates

Reports automatically update via Firestore listeners. No manual refresh needed:

```tsx
'use client';

import { useReports } from '@/contexts/reports-context';
import { useEffect } from 'react';

export function ReportMonitor() {
  const { reports } = useReports();

  useEffect(() => {
    // This effect runs whenever reports change
    const analyzingReports = reports.filter(r => r.status === 'analyzing');
    
    if (analyzingReports.length > 0) {
      console.log(`${analyzingReports.length} reports being analyzed...`);
    }
  }, [reports]);

  return null;
}
```

## Mobile Application (React Native)

### 1. Setup Context Provider

Add to your app root:

**File**: `App.tsx` or `_layout.tsx` (Expo Router)

```tsx
import { ReportsProvider } from '@/contexts/reports-context';
import { PropertyProvider } from '@/contexts/property-context';
import { AuthProvider } from '@/contexts/auth-context';

export default function App() {
  return (
    <AuthProvider>
      <PropertyProvider>
        <ReportsProvider>
          <Navigation />
        </ReportsProvider>
      </PropertyProvider>
    </AuthProvider>
  );
}
```

### 2. Create Reports Screen

**File**: `screens/PropertyReportsScreen.tsx`

```tsx
import React from 'react';
import { View, FlatList, TouchableOpacity, Text } from 'react-native';
import { useReports } from '@/contexts/reports-context';

export function PropertyReportsScreen() {
  const { reports, loading, setSelectedReport } = useReports();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setSelectedReport(item)}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.status}>{item.status}</Text>
            {item.aiAnalysis && (
              <Text style={styles.condition}>
                {item.aiAnalysis.overallCondition}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

### 3. File Picker Integration

```tsx
import * as DocumentPicker from 'expo-document-picker';
import { useReports } from '@/contexts/reports-context';

export function UploadReportButton() {
  const { uploadReport } = useReports();

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        // Convert to File object
        const file = {
          uri: result.uri,
          name: result.name,
          type: result.mimeType,
        };

        await uploadReport(file as any, 'HOME_INSPECTION');
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handlePickDocument}>
      <Text>Upload Report</Text>
    </TouchableOpacity>
  );
}
```

## Type Definitions

### InspectionReport

```typescript
interface InspectionReport {
  id: string;
  userId: string;
  propertyId: string;
  name: string;
  url: string;
  storagePath: string;
  gsURI: string;
  contentType: string;
  createdAt: Timestamp;
  inspectionDate?: Timestamp;
  inspectorName?: string;
  inspectorCompany?: string;
  reportType: "HOME_INSPECTION" | "PRE_PURCHASE" | "ANNUAL" | "SPECIALIZED" | "OTHER";
  status: "uploading" | "analyzing" | "complete" | "failed";
  aiAnalysis?: {
    summary: string;
    overallCondition: "excellent" | "good" | "fair" | "poor" | "critical";
    issues: ReportIssue[];
    recommendations: ReportRecommendation[];
    keyFindings: string[];
    costEstimates?: {
      immediate: number;
      shortTerm: number;
      longTerm: number;
    };
    analyzedAt: Timestamp;
    confidence: number;
  };
  embedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Timestamp;
}
```

### ReportIssue

```typescript
interface ReportIssue {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: "minor" | "moderate" | "major" | "critical";
  location: string;
  priority: number;
  estimatedCost?: number;
  pageNumber?: number;
  confidence: number;
}
```

### ReportRecommendation

```typescript
interface ReportRecommendation {
  id: string;
  issue: string;
  recommendation: string;
  timeframe: "immediate" | "short_term" | "long_term" | "monitoring";
  estimatedCost?: number;
  diyFeasible: boolean;
}
```

## Component Props

### UploadReportsDialog

```typescript
interface UploadReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

### ReportDetailView

```typescript
interface ReportDetailViewProps {
  report: InspectionReport | null;
  onClose: () => void;
}
```

## Styling

### Tailwind CSS Classes

Commonly used classes in reports components:

```css
/* Status badges */
.status-complete { @apply bg-green-100 text-green-800; }
.status-analyzing { @apply bg-blue-100 text-blue-800; }
.status-failed { @apply bg-red-100 text-red-800; }

/* Severity badges */
.severity-critical { @apply bg-red-100 text-red-800; }
.severity-major { @apply bg-orange-100 text-orange-800; }
.severity-moderate { @apply bg-yellow-100 text-yellow-800; }
.severity-minor { @apply bg-blue-100 text-blue-800; }

/* Condition colors */
.condition-excellent { @apply text-green-600; }
.condition-good { @apply text-blue-600; }
.condition-fair { @apply text-yellow-600; }
.condition-poor { @apply text-orange-600; }
.condition-critical { @apply text-red-600; }
```

## Error Handling

### Upload Errors

```tsx
try {
  await uploadReport(file, reportType);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('size')) {
      toast.error('File too large. Maximum size is 50MB.');
    } else if (error.message.includes('type')) {
      toast.error('Invalid file type. Please upload PDF or images.');
    } else {
      toast.error('Upload failed. Please try again.');
    }
  }
}
```

### Chat Errors

```tsx
try {
  const answer = await chatWithReport(reportId, question);
  setAnswer(answer);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('404')) {
      toast.error('Report not found or not analyzed yet.');
    } else {
      toast.error('Failed to get answer. Please try again.');
    }
  }
}
```

## Performance Optimization

### 1. Lazy Load Reports Tab

```tsx
import { lazy, Suspense } from 'react';

const PropertyReportsTab = lazy(() => import('@/components/properties/property-reports-tab'));

export function PropertyTabs() {
  return (
    <TabsContent value="reports">
      <Suspense fallback={<LoadingSpinner />}>
        <PropertyReportsTab />
      </Suspense>
    </TabsContent>
  );
}
```

### 2. Pagination (Future)

```tsx
const { reports, hasMore, loadMore } = useReports();

const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollHeight - scrollTop === clientHeight && hasMore) {
    loadMore();
  }
};
```

### 3. Memoize Expensive Computations

```tsx
import { useMemo } from 'react';

const criticalIssuesCount = useMemo(() => {
  return reports.reduce((count, report) => {
    if (!report.aiAnalysis) return count;
    return count + report.aiAnalysis.issues.filter(
      issue => typeof issue === 'object' && issue.severity === 'critical'
    ).length;
  }, 0);
}, [reports]);
```

## Testing

### Unit Tests

```tsx
import { render, screen } from '@testing-library/react';
import { ReportCard } from '@/components/reports/report-card';

const mockReport: InspectionReport = {
  id: 'test-1',
  name: 'Test Report',
  status: 'complete',
  // ... other required fields
};

test('renders report card', () => {
  render(<ReportCard report={mockReport} onClick={() => {}} />);
  expect(screen.getByText('Test Report')).toBeInTheDocument();
});
```

### Integration Tests

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useReports } from '@/contexts/reports-context';

test('uploads report successfully', async () => {
  const { result } = renderHook(() => useReports());
  
  const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
  
  await act(async () => {
    await result.current.uploadReport(file, 'HOME_INSPECTION');
  });
  
  await waitFor(() => {
    expect(result.current.reports).toHaveLength(1);
  });
});
```

## Best Practices

1. **Always check report status** before displaying analysis data
2. **Handle loading states** gracefully
3. **Provide clear error messages** to users
4. **Show upload progress** for large files
5. **Use optimistic updates** where appropriate
6. **Cache chat responses** to avoid redundant API calls
7. **Lazy load** report detail views
8. **Implement retry logic** for failed uploads
9. **Add analytics tracking** for user interactions
10. **Follow accessibility guidelines** (ARIA labels, keyboard navigation)

## Troubleshooting

### Reports not showing up
- Check Firestore security rules
- Verify user is authenticated
- Check property context is set
- Verify collection path is correct

### Upload failing
- Check file size (< 50MB)
- Verify file type (PDF or images)
- Check Firebase Storage rules
- Verify API URL and webhook secret

### Analysis stuck
- Check Cloud Function logs
- Verify Pub/Sub subscription
- Check for timeout issues
- Verify Gemini API quota

### Chat not working
- Verify report is fully analyzed (status: complete)
- Check API endpoint configuration
- Verify report context is being passed
- Check for CORS issues

