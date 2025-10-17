import { useTheme } from './use-theme';

export function useColorScheme() {
  const { colorScheme } = useTheme();
  return colorScheme;
}