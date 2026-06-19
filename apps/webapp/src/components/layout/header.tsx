
'use client';

import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import { HeaderToolbarActions } from '@/components/layout/header-toolbar-actions';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 min-h-14 items-center justify-between gap-3 border-b bg-background px-3 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 shrink items-center gap-2">
        <AssetMemBrandIcon size="sm" />
        <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">AssetMem AI</h1>
      </div>
      <HeaderToolbarActions />
    </header>
  );
}
