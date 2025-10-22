

'use client';

import { useProperty } from "@/contexts/property-context";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Home, ShieldCheck, ReceiptText, Search, FileKey, Upload, Calendar, Eye, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import type { Document as DocumentType } from '@/lib/types';
import { useRouter } from "next/navigation";
import { format } from "date-fns";


const docTypeIcons: { [key: string]: React.ElementType } = {
  DEED: Home,
  INSURANCE_POLICY: ShieldCheck,
  UTILITY_BILL: ReceiptText,
  INSPECTION_REPORT: Search,
  MORTGAGE_STATEMENT: FileKey,
  OTHER: FileText,
};

type ContextDocumentsPanelProps = {
    onUploadClick: () => void;
}

export function ContextDocumentsPanel({ onUploadClick }: ContextDocumentsPanelProps) {
    const { documents, isLoading } = useProperty();
    const router = useRouter();

    const getFileExtension = (contentType: string | undefined) => {
        if (!contentType) return 'DOC';
        const parts = contentType.split('/');
        return (parts[1] || 'doc').toUpperCase();
    }

    return (
        <aside className="h-full w-80 border-l bg-sidebar flex flex-col hidden lg:flex">
            <header className="p-4 border-b space-y-1 shrink-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Property Documents</h2>
                </div>
                <p className="text-sm text-muted-foreground">{documents.length} document{documents.length !== 1 ? 's' : ''} uploaded</p>
            </header>
            <ScrollArea className="flex-1">
                <div className="p-4">
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
                            <div className="p-3 bg-sidebar-accent rounded-full">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-foreground">No documents uploaded yet</p>
                                <p className="text-xs text-muted-foreground">Upload documents in the 'Details' tab.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {documents.map(doc => {
                                const Icon = docTypeIcons[doc.documentType || 'OTHER'] || FileText;
                                const fileType = getFileExtension(doc.contentType);
                                return (
                                <Card key={doc.id} className="bg-background">
                                    <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                            <Icon className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate" title={doc.name}>
                                                    {doc.name}
                                                </p>
                                                <div className="flex items-center gap-4 mt-1">
                                                     <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700">{fileType}</Badge>
                                                     {doc.createdAt && (
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            <span>{format(doc.createdAt.toDate(), 'M/d/yyyy')}</span>
                                                        </div>
                                                     )}
                                                </div>
                                            </div>
                                        </div>
                                         <div className="flex items-center gap-2 mt-3">
                                            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                                    <Eye className="h-4 w-4 mr-2" /> View
                                                </a>
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer" download={doc.name}>
                                                    <Download className="h-4 w-4 mr-2" /> Download
                                                </a>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )})}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </aside>
    );
}
