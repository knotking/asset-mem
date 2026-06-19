

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, ArrowLeft, PanelLeft, Home, FileText, ChevronRight, PanelRightClose, PanelLeftOpen, Upload, PlusCircle, Pencil, Check, X as CancelIcon, Wrench, CheckCircle2, PanelLeftClose, PanelRight, PanelRightOpen, ChevronLeft, X, MessageSquare, Clock, ClipboardList } from 'lucide-react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { Document as DocumentType, Session, Property } from '@/lib/types';
import React, { useEffect, useState, useCallback, cloneElement } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PropertyProvider, useProperty } from '@/contexts/property-context';
import { CheckpointProvider } from '@/contexts/checkpoint-context';
import { ReportsProvider } from '@/contexts/reports-context';
import { SavedServiceProvidersProvider } from '@/contexts/saved-service-providers-context';
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
import { MyProsSheetProvider } from '@/contexts/my-pros-sheet-context';


function PropertyTabs() {
    const params = useParams();
    const pathname = usePathname();
    const propertyId = params.propertyId as string;
    
    const tabs = [
        { name: 'AI Chat', href: `/home/properties/${propertyId}/chat`, segment: 'chat', icon: MessageSquare },
        { name: 'Timeline', href: `/home/properties/${propertyId}/checkpoints`, segment: 'checkpoints', icon: Clock },
        { name: 'Details', href: `/home/properties/${propertyId}/details`, segment: 'details', icon: FileText},
    ];

    return (
        <div className="">
             <nav className="flex space-x-0 p-1  bg-muted" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = pathname.includes(`/${tab.segment}`);
                    const Icon = tab.icon;
                    
                    if (tab.href === '#') {
                         return (
                            <button
                                key={tab.name}
                                disabled
                                className={cn(
                                    'flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium text-muted-foreground/50 sm:gap-2 sm:px-4 sm:text-sm'
                                )}
                            >
                                {Icon && <Icon className="h-4 w-4" />}
                                {tab.name}
                            </button>
                        )
                    }
                    
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm',
                                isActive
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {Icon && <Icon className="h-4 w-4" />}
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
      <header className="border-b bg-background p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/home')}
            className="shrink-0 px-2 sm:px-3"
            aria-label="Back to properties"
          >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Properties</span>
          </Button>
          <div className="hidden h-8 w-px bg-border sm:block" />
          <div className='min-w-0 flex-1'>
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
  const isChatActive = pathname.includes('/chat');
  const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] = useState(false);
  const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);

  if (!isChatActive) {
    return (
        <div className="flex flex-col flex-1 min-h-0">
            <main className="flex-1 overflow-y-auto relative">
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
        
        {/* Context is managed in the chat composer (Add context), not the sidebar panel. */}
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
            <div className='h-full flex flex-col min-h-0'>
                <PropertyHeader />
                <PropertyTabs />
                <main className="flex-1 min-h-0">
                    <PropertyChatLayoutContent>
                        {children}
                    </PropertyChatLayoutContent>
                </main>
            </div>
            <UploadDocumentsDialog open={isOpen} onOpenChange={onClose} />
        </>
    );
  }


function SavedProvidersScope({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const propertyId = params.propertyId as string | undefined;
  return (
    <SavedServiceProvidersProvider propertyId={propertyId}>
      {children}
    </SavedServiceProvidersProvider>
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
        <SavedProvidersScope>
          <MyProsSheetProvider>
            <CheckpointProvider>
              <ReportsProvider>
                <PropertyDocumentsProvider>
                  <UploadDialogProvider>
                    <AddressConfirmationProvider>
                        <LayoutWithDialog>{children}</LayoutWithDialog>
                    </AddressConfirmationProvider>
                  </UploadDialogProvider>
                </PropertyDocumentsProvider>
              </ReportsProvider>
            </CheckpointProvider>
          </MyProsSheetProvider>
        </SavedProvidersScope>
      </PropertyProvider>
    </SessionProvider>
  );
}
