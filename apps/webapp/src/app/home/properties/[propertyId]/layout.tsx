

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
import {
  APP_NAV_TAB_CLASS,
  APP_PROPERTY_TITLE_CLASS,
  APP_SHEET_TITLE_CLASS,
} from '@/lib/app-typography';
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
import { HeaderToolbarActions } from '@/components/layout/header-toolbar-actions';
import { displayPropertyName } from '@/lib/display-property-name';


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
             <nav className="flex space-x-0 bg-muted p-0.5 sm:p-1" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = pathname.includes(`/${tab.segment}`);
                    const Icon = tab.icon;
                    
                    if (tab.href === '#') {
                         return (
                            <button
                                key={tab.name}
                                disabled
                                className={cn(
                                    'flex flex-1 cursor-not-allowed items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-2.5 text-muted-foreground/50 md:gap-2 md:px-4 md:py-2',
                                    APP_NAV_TAB_CLASS,
                                )}
                                aria-label={tab.name}
                            >
                                {Icon && <Icon className="h-4 w-4" />}
                                <span className="hidden md:inline">{tab.name}</span>
                            </button>
                        )
                    }
                    
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            aria-label={tab.name}
                            title={tab.name}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-2.5 transition-colors md:gap-2 md:px-4 md:py-2',
                                APP_NAV_TAB_CLASS,
                                isActive
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {Icon && <Icon className="h-4 w-4" />}
                                <span className="hidden md:inline">{tab.name}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

type PropertyHeaderProps = {
  /** Tighter mobile header — property name only below sm; address from sm up. */
  compact?: boolean;
  onOpenSessions?: () => void;
};

function PropertyHeader({ compact, onOpenSessions }: PropertyHeaderProps) {
  const params = useParams();
  const router = useRouter();
  const { property, isLoading: isPropertyLoading } = useProperty();
  const isNewPropertyFlow = params.propertyId === 'new-property';

  return (
      <header
        className={cn(
          'border-b bg-background',
          compact ? 'px-2 py-2 sm:p-4' : 'p-3 sm:p-4',
        )}
      >
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
          <div className="min-w-0 flex-1 overflow-hidden">
            {isPropertyLoading ? (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton
                      className={cn('h-4 w-60', compact && 'hidden sm:block')}
                    />
                </div>
            ) : (
              <div className="min-w-0 overflow-hidden">
                    <h1
                      className={cn(APP_PROPERTY_TITLE_CLASS, 'block w-full')}
                      title={property?.name}
                    >
                        {isNewPropertyFlow && <PlusCircle className="h-4 w-4 text-primary inline-block mr-2" />}
                        <span className="sm:hidden">
                          {displayPropertyName(
                            isNewPropertyFlow ? 'New Property' : property?.name,
                          )}
                        </span>
                        <span className="hidden sm:inline">
                          {property?.name || 'New Property'}
                        </span>
                    </h1>
                    <p
                      className={cn(
                        'text-sm text-muted-foreground truncate',
                        compact && 'hidden sm:block',
                      )}
                      title={property?.address}
                    >
                      {isNewPropertyFlow
                        ? 'Upload documents to get started'
                        : property?.address || '...'}
                    </p>
              </div>
            )}
          </div>
          {onOpenSessions ? (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 md:hidden"
              onClick={onOpenSessions}
              aria-label="Open chat sessions"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <HeaderToolbarActions className="md:hidden" compactAccount />
        </div>
      </header>
  );
}

type PropertyChatLayoutContentProps = {
  children: React.ReactNode;
  isChatActive: boolean;
  isSessionSidebarCollapsed: boolean;
  onToggleSessionSidebarCollapse: () => void;
};

function PropertyChatLayoutContent({
  children,
  isChatActive,
  isSessionSidebarCollapsed,
  onToggleSessionSidebarCollapse,
}: PropertyChatLayoutContentProps) {
  if (!isChatActive) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {children}
        </main>
      </div>
    );
  }

  return (
      <div className="flex h-full w-full">
        <aside
          className={cn(
            'relative z-20 hidden flex-col border-r bg-sidebar transition-all duration-300 md:flex',
            isSessionSidebarCollapsed ? 'md:w-14' : 'md:w-80',
          )}
        >
            <SessionNavBar
                isCollapsed={isSessionSidebarCollapsed}
                onToggleCollapse={onToggleSessionSidebarCollapse}
                isMobileOpen={false}
                onMobileClose={() => {}}
            />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="relative min-h-0 flex-1 overflow-hidden">
                <div className="h-full min-w-0 overflow-x-hidden">
                  {children}
                </div>
            </main>
        </div>
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
                        <h2 className={APP_SHEET_TITLE_CLASS}>{title}</h2>
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
    const pathname = usePathname();
    const isNewPropertyFlow = params.propertyId === 'new-property';
    const isChatActive = pathname.includes('/chat');
    const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] = useState(false);
    const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);

    useEffect(() => {
        if (isNewPropertyFlow) {
          onOpen();
        }
    }, [isNewPropertyFlow, onOpen]);
  
    return (
        <>
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <PropertyHeader
                  compact
                  onOpenSessions={
                    isChatActive ? () => setIsMobileSessionOpen(true) : undefined
                  }
                />
                <PropertyTabs />
                <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <PropertyChatLayoutContent
                      isChatActive={isChatActive}
                      isSessionSidebarCollapsed={isSessionSidebarCollapsed}
                      onToggleSessionSidebarCollapse={() =>
                        setIsSessionSidebarCollapsed((v) => !v)
                      }
                    >
                        {children}
                    </PropertyChatLayoutContent>
                </main>
            </div>
            {isChatActive ? (
              <Sheet open={isMobileSessionOpen} onOpenChange={setIsMobileSessionOpen}>
                <SheetContent
                  side="left"
                  showCloseButton={false}
                  className="flex w-full max-w-sm flex-col p-0 md:hidden"
                >
                  <SheetTitle className="sr-only">Chat sessions</SheetTitle>
                  <SessionNavBar
                    isCollapsed={false}
                    onToggleCollapse={() => {}}
                    isMobileOpen={isMobileSessionOpen}
                    onMobileClose={() => setIsMobileSessionOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            ) : null}
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
