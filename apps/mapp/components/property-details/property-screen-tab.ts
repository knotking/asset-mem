export type PropertyScreenTab = 'chat' | 'timeline' | 'details' | 'providers';

export function parsePropertyScreenTab(
  tab: string | undefined,
  isNew: boolean
): PropertyScreenTab {
  if (tab === 'details') return 'details';
  if (tab === 'timeline') return 'timeline';
  if (tab === 'providers') return 'providers';
  if (isNew) return 'details';
  return 'chat';
}
