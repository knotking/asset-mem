export type PropertyScreenTab = 'chat' | 'timeline' | 'details';

export type TimelineSubTab = 'checkpoints' | 'insights' | 'reports';

/** Legacy tab route — opens chat and triggers the My pros drawer. */
export function shouldOpenMyProsFromTab(tab: string | undefined): boolean {
  return tab === 'providers';
}

export function parsePropertyScreenTab(
  tab: string | undefined,
  isNew: boolean,
  propertyId?: string
): PropertyScreenTab {
  if (propertyId === 'new-property') return 'details';
  if (tab === 'details') return 'details';
  if (tab === 'timeline' || tab === 'reports') return 'timeline';
  if (tab === 'providers') return 'chat';
  if (isNew) return 'details';
  return 'chat';
}

export function parseTimelineSubTab(tab: string | undefined): TimelineSubTab {
  if (tab === 'reports') return 'reports';
  return 'checkpoints';
}
