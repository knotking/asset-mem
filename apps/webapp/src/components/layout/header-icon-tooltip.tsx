'use client';

import type { ReactElement } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePrefersFinePointer } from '@/hooks/use-prefers-fine-pointer';

type HeaderIconTooltipProps = {
  label: string;
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

/** Icon-only header control; parent must wrap toolbar in `TooltipProvider`. */
export function HeaderIconTooltip({
  label,
  children,
  side = 'bottom',
}: HeaderIconTooltipProps) {
  const showTooltip = usePrefersFinePointer();

  if (!showTooltip) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
