export type PropertyScreenTab = 'chat' | 'timeline' | 'details' | 'providers';

export function parsePropertyScreenTab(
  tab: string | undefined,
  isNew: boolean,
  propertyId?: string
): PropertyScreenTab {
  if (propertyId === 'new-property') return 'details';
  if (tab === 'details') return 'details';
  if (tab === 'timeline') return 'timeline';
  if (tab === 'providers') return 'providers';
  if (isNew) return 'details';
  return 'chat';
}
