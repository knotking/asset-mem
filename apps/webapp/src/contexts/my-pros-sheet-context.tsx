'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MyProsPanel } from '@/components/property/my-pros-panel';
import { useProperty } from '@/contexts/property-context';
import { OPEN_MY_PROS_PARAM } from '@/lib/my-pros-navigation';

type MyProsSheetContextValue = {
  openMyPros: () => void;
  closeMyPros: () => void;
};

const MyProsSheetContext = React.createContext<MyProsSheetContextValue | undefined>(undefined);

export function MyProsSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { property } = useProperty();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openHandledRef = React.useRef(false);

  React.useEffect(() => {
    if (openHandledRef.current) return;
    if (searchParams.get(OPEN_MY_PROS_PARAM) !== '1') return;
    openHandledRef.current = true;
    setOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete(OPEN_MY_PROS_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const value = React.useMemo(
    () => ({
      openMyPros: () => setOpen(true),
      closeMyPros: () => setOpen(false),
    }),
    []
  );

  return (
    <MyProsSheetContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle>My pros</SheetTitle>
            <SheetDescription>
              {property?.name ? `Saved for ${property.name}` : 'Saved service pros for this property'}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <MyProsPanel />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </MyProsSheetContext.Provider>
  );
}

export function useMyProsSheet() {
  const context = React.useContext(MyProsSheetContext);
  if (!context) {
    throw new Error('useMyProsSheet must be used within MyProsSheetProvider');
  }
  return context;
}
