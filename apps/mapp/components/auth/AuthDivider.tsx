import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export function AuthDivider() {
  return (
    <View className="relative my-4 w-full max-w-sm flex-row items-center">
      <View className="h-px flex-1 bg-border" />
      <Text className="mx-3 text-xs uppercase text-muted-foreground">Or continue with email</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
