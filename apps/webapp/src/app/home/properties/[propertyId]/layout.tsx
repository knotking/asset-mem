

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, ArrowLeft, PanelLeft, Home, FileText, ChevronRight, PanelRightClose, PanelLeftOpen, Upload, PlusCircle, Pencil, Check, X as CancelIcon, Wrench, CheckCircle2, PanelLeftClose, PanelRight, PanelRightOpen, ChevronLeft, X } from 'lucide-react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { Document as DocumentType, Session, Property } from '@/lib/types';
import React, { useEffect, useState, useCallback, cloneElement } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PropertyProvider, useProperty } from '@/contexts/property-context';
import { CheckpointProvider } from '@/contexts/checkpoint-context';
import { ContextDocumentsPanel } from '@/components/properties/context-documents-panel';
import { cn } from '@/lib/utils';
import { SessionNavBar } from '@/components/chat/session-sidebar';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadDocumentsDialog } from '@/components/properties/upload-documents-dialog';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionProvider } from '@/contexts/session-context';
import Link from 'next/link';
import { UploadDialogProvider, useUploadDialog } from '@/contexts/upload-dialog-context';
import { PropertyDocumentsProvider } from '@/contexts/property-documents-context';
import { AddressConfirmationProvider } from '@/contexts/address-confirmation-context';


function PropertyTabs() {
    const params = useParams();
    const pathname = usePathname();
    const propertyId = params.propertyId as string;
    
    const tabs = [
        { name: 'AI Chat', href: `/home/properties/${propertyId}/chat`, segment: 'chat' },
        { name: 'Timeline', href: `/home/properties/${propertyId}/checkpoints`, segment: 'checkpoints' },
        { name: 'Details', href: `/home/properties/${propertyId}/details`, segment: 'details'},
        // { name: 'Services', href: '#', segment: 'services' },
        // { name: 'Providers', href: '#', segment: 'providers' },
    ];

    return (
        <div className="">
             <nav className="flex space-x-0 p-1  bg-muted" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = pathname.includes(`/${tab.segment}`);
                    
                    if (tab.href === '#') {
                         return (
                            <button
                                key={tab.name}
                                disabled
                                className={cn(
                                    'flex-1 text-center whitespace-nowrap py-2 px-4 rounded-md font-medium text-sm text-muted-foreground/50 cursor-not-allowed'
                                )}
                            >
                                {tab.name}
                            </button>
                        )
                    }
                    
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                'flex-1 text-center whitespace-nowrap py-2 px-4 rounded-md font-medium text-sm transition-colors',
                                isActive
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {tab.name}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

function PropertyHeader() {
  const params = useParams();
  const router = useRouter();
  const { property, isLoading: isPropertyLoading } = useProperty();
  const isNewPropertyFlow = params.propertyId === 'new-property';

  return (
      <header className="p-4 border-b flex justify-between items-center gap-4 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push('/home')} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
          </Button>
          <div className="h-8 w-px bg-border" />
          <div className='min-w-0 flex-1 group'>
            {isPropertyLoading ? (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-60" />
                </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className='flex-1 min-w-0'>
                    <h1 className="text-base font-semibold text-foreground truncate" title={property?.name}>
                        {isNewPropertyFlow && <PlusCircle className="h-4 w-4 text-primary inline-block mr-2" />}
                        {property?.name || 'New Property'}
                    </h1>
                    <p className="text-sm text-muted-foreground truncate" title={property?.address}>{isNewPropertyFlow ? "Upload documents to get started" : property?.address || '...'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
  );
}

function PropertyChatLayoutContent({ children }: { children: React.ReactNode; }) {
  const pathname = usePathname();
  const { onOpen: openUploadDialog } = useUploadDialog();
  const isChatActive = pathname.includes('/chat');
  const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] = useState(false);
  const [isResourcesPanelCollapsed, setIsResourcesPanelCollapsed] = useState(false);
  
  const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);
  const [isMobileResourcesOpen, setIsMobileResourcesOpen] = useState(false);

  if (!isChatActive) {
    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto relative">
                {children}
            </main>
        </div>
    )
  }

  return (
      <div className="flex h-full w-full relative">
        <aside className={cn(
            "lg:relative border-r bg-sidebar transition-all duration-300 z-20",
            "lg:w-64",
            isSessionSidebarCollapsed ? 'lg:w-14' : 'lg:w-80',
            !isMobileSessionOpen && "hidden lg:flex flex-col",
            isMobileSessionOpen && "absolute inset-0 w-full max-w-sm flex flex-col"
            )}>
            <SessionNavBar 
                isCollapsed={isSessionSidebarCollapsed}
                onToggleCollapse={() => setIsSessionSidebarCollapsed(!isSessionSidebarCollapsed)}
                isMobileOpen={isMobileSessionOpen}
                onMobileClose={() => setIsMobileSessionOpen(false)}
            />
        </aside>

        <div className="flex flex-col flex-1 overflow-hidden">
            <main className="flex-1 overflow-hidden relative">
                 <div className="absolute top-2 left-2 z-10 lg:hidden">
                    <Button variant="outline" size="icon" onClick={() => setIsMobileSessionOpen(true)}>
                        <PanelLeft className="h-4 w-4" />
                    </Button>
                </div>
                {children}
            </main>
        </div>
        
        <div className="absolute top-2 right-2 z-10 lg:hidden">
            <Button variant="outline" size="icon" onClick={() => setIsMobileResourcesOpen(true)}>
                <PanelRight className="h-4 w-4" />
            </Button>
        </div>

        <aside className={cn(
            "lg:relative border-l bg-sidebar transition-all duration-300 z-20",
            "lg:w-80",
            isResourcesPanelCollapsed ? 'lg:w-14' : 'lg:w-80',
            !isMobileResourcesOpen && "hidden lg:flex flex-col",
            isMobileResourcesOpen && "absolute inset-y-0 right-0 w-full max-w-sm flex flex-col"
            )}>
            <ContextDocumentsPanel 
                onUploadClick={openUploadDialog} 
                isCollapsed={isResourcesPanelCollapsed} 
                onToggleCollapse={() => setIsResourcesPanelCollapsed(!isResourcesPanelCollapsed)}
                isMobileOpen={isMobileResourcesOpen}
                onMobileClose={() => setIsMobileResourcesOpen(false)}
            />
        </aside>
      </div>
  );
}

function MobileSheet({ children, side, triggerIcon, title, contentClassName }: { children: React.ReactNode, side: 'left' | 'right', triggerIcon: React.ReactNode, title: string, contentClassName?: string }) {
    
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    {triggerIcon}
                </Button>
            </SheetTrigger>
            <SheetContent side={side} className={cn("p-0 flex flex-col", contentClassName)}>
                <header className="p-4 border-b">
                    <SheetTitle asChild>
                        <h2 className="font-semibold text-lg">{title}</h2>
                    </SheetTitle>
                </header>
                <ScrollArea className="flex-1">
                    {children}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}

function LayoutWithDialog({ children }: { children: React.ReactNode }) {
    const { isOpen, onClose, onOpen } = useUploadDialog();
    const params = useParams();
    const isNewPropertyFlow = params.propertyId === 'new-property';

    useEffect(() => {
        if (isNewPropertyFlow) {
          onOpen();
        }
    }, [isNewPropertyFlow, onOpen]);
  
    return (
        <>
            <div className='h-full flex flex-col'>
                <PropertyHeader />
                <PropertyTabs />
                <main className="flex-1 overflow-hidden">
                    <PropertyChatLayoutContent>
                        {children}
                    </PropertyChatLayoutContent>
                </main>
            </div>
            <UploadDocumentsDialog open={isOpen} onOpenChange={onClose} />
        </>
    );
  }


export default function PropertyChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <PropertyProvider>
        <CheckpointProvider>
          <PropertyDocumentsProvider>
            <UploadDialogProvider>
              <AddressConfirmationProvider>
                  <LayoutWithDialog>{children}</LayoutWithDialog>
              </AddressConfirmationProvider>
            </UploadDialogProvider>
          </PropertyDocumentsProvider>
        </CheckpointProvider>
      </PropertyProvider>
    </SessionProvider>
  );
}
