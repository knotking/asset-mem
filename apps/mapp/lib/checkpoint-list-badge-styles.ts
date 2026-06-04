import type { CheckpointListBadgeVariant } from '@homeapp/common/lib/checkpoint-list-badge';

/** NativeWind classes for checkpoint list badges (mapp only). */
export function checkpointListBadgeStyles(variant: CheckpointListBadgeVariant): {
  containerClass: string;
  textClass: string;
} {
  switch (variant) {
    case 'critical':
      return {
        containerClass: 'rounded-full bg-destructive/10 px-2 py-0.5',
        textClass: 'text-[10px] font-medium text-destructive',
      };
    case 'major':
      return {
        containerClass: 'rounded-full bg-orange-100 px-2 py-0.5 dark:bg-orange-950',
        textClass: 'text-[10px] font-medium text-orange-800 dark:text-orange-200',
      };
    case 'needs_attention':
      return {
        containerClass: 'rounded-full bg-yellow-100 px-2 py-0.5 dark:bg-yellow-950',
        textClass: 'text-[10px] font-medium text-yellow-800 dark:text-yellow-200',
      };
    case 'good':
      return {
        containerClass: 'rounded-full bg-green-100 px-2 py-0.5 dark:bg-green-950',
        textClass: 'text-[10px] font-medium text-green-800 dark:text-green-200',
      };
    case 'no_analysis':
      return {
        containerClass: 'rounded-full bg-muted px-2 py-0.5',
        textClass: 'text-[10px] font-medium text-muted-foreground',
      };
  }
}
