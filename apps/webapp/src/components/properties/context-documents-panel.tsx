

'use client';

import { useState } from 'react';
import { useProperty } from "@/contexts/property-context";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Wrench, CheckCircle2, Calendar, ChevronLeft, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import type { Document as DocumentType } from '@/lib/types';
import { format } from "date-fns";
import { Checkbox } from '../ui/checkbox';
import { usePropertyDocuments } from '@/contexts/property-documents-context';


const docTypeIcons: { [key: string]: React.ElementType } = {
  DEED: FileText,
  INSURANCE_POLICY: FileText,
  UTILITY_BILL: FileText,
  INSPECTION_REPORT: FileText,
  MORTGAGE_STATEMENT: FileText,
  OTHER: FileText,
};

function DocumentItem({ doc, onSelect, isSelected }: { doc: DocumentType, onSelect: (doc: DocumentType) => void, isSelected: boolean }) {
    const getFileExtension = (contentType: string | undefined) => {
        if (!contentType) return 'DOC';
        const parts = contentType.split('/');
        return (parts[1] || 'doc').toUpperCase();
    }
    
    const Icon = docTypeIcons[doc.documentType || 'OTHER'] || FileText;
    const fileType = getFileExtension(doc.contentType);

    return (
        <label htmlFor={`doc-${doc.id}`} className="block">
            <Card className={cn("bg-background group relative cursor-pointer hover:bg-muted/50", isSelected && "border-primary/50 ring-1 ring-primary/50")}>
                <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-1 items-start gap-3 min-w-0">
                             <Checkbox 
                                id={`doc-${doc.id}`}
                                checked={isSelected} 
                                onCheckedChange={() => onSelect(doc)}
                                className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate" title={doc.name}>
                                    {doc.name}
                                </p>
                                <div className="flex items-center gap-4 mt-1.5">
                                     <Badge variant="outline" className="text-xs">{fileType}</Badge>
                                     {doc.createdAt && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <span>{format(doc.createdAt.toDate(), 'M/d/yyyy')}</span>
                                        </div>
                                     )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </label>
    );
}

const ResourceTabs = () => {
    const tabs = [
        { name: 'Docs', icon: FileText, active: true },
        // { name: 'Services', icon: Wrench, active: false },
        // { name: 'Checks', icon: CheckCircle2, active: false },
    ];
    return (
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {tabs.map(tab => (
                <Button 
                    key={tab.name}
                    variant={tab.active ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn(
                        "flex-1 justify-center text-xs h-8",
                        !tab.active && "text-muted-foreground"
                    )}
                    disabled={!tab.active}
                >
                    <tab.icon className="h-4 w-4" />
                    {tab.name}
                </Button>
            ))}
        </div>
    )
}

type ContextDocumentsPanelProps = {
    onUploadClick: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    isMobileOpen: boolean;
    onMobileClose: () => void;
}

export function ContextDocumentsPanel({ onUploadClick, isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: ContextDocumentsPanelProps) {
    const { documents, isLoading } = useProperty();
    const { selectedDocuments, handleDocumentSelect } = usePropertyDocuments();
    
    if (isCollapsed && !isMobileOpen) {
        return (
            <div className="h-full flex items-center justify-center">
                 <Button variant="ghost" className="h-full w-full rounded-none flex flex-col items-center justify-center gap-2" onClick={onToggleCollapse}>
                    <span className="[writing-mode:vertical-lr] rotate-180 text-sm font-semibold">Select Resources</span>
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full w-full">
            <header className='p-4 border-b flex items-center justify-between'>
                <h2 className="text-lg font-semibold">Select Resources</h2>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hidden lg:flex items-center justify-center" onClick={onToggleCollapse}>
                        <ChevronLeft className="h-4 w-4 rotate-180" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={onMobileClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </header>
            <div className='p-4 border-b'>
                 <ResourceTabs />
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
                            <div className="p-3 bg-sidebar-accent rounded-full">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-foreground">No documents found</p>
                                <p className="text-xs text-muted-foreground">Upload documents in the 'Details' tab.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {documents.map(doc => (
                                <DocumentItem 
                                    key={doc.id} 
                                    doc={doc}
                                    onSelect={handleDocumentSelect}
                                    isSelected={selectedDocuments.some(d => d.id === doc.id)} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
