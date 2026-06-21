import * as React from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react-native';
import { AssetMemWordmark } from '@/components/AssetMemWordmark';
import { AuthDivider } from '@/components/auth/AuthDivider';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { AuthLegalNotice } from '@/components/auth/AuthLegalNotice';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export function AuthFieldLabel({ children, className }: { children: string; className?: string }) {
  return (
    <Text className={cn('mb-1.5 text-sm font-medium text-foreground', className)}>
      {children}
    </Text>
  );
}

type AuthScreenShellProps = {
  title: string;
  subtitle: string;
  formDisabled: boolean;
  error: string | null;
  success: string | null;
  onOAuthSuccess: () => void;
  onOAuthError: (message: string) => void;
  primaryAction: {
    label: string;
    loadingLabel: string;
    onPress: () => void;
  };
  showLegalNotice?: boolean;
  footer: React.ReactNode;
  children: React.ReactNode;
  formClassName?: string;
} & Pick<ViewProps, 'testID'>;

export function AuthScreenShell({
  title,
  subtitle,
  formDisabled,
  error,
  success,
  onOAuthSuccess,
  onOAuthError,
  primaryAction,
  showLegalNotice = false,
  footer,
  children,
  formClassName,
}: AuthScreenShellProps) {
  const [authExtrasReady, setAuthExtrasReady] = React.useState(false);

  React.useEffect(() => {
    setAuthExtrasReady(true);
  }, []);

  const loading = formDisabled;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        className="flex-1 bg-background">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="items-center px-4 pb-2 pt-4">
            <AssetMemWordmark size="auth" align="center" className="mb-5" />
            <Text className="mb-1 w-full max-w-sm text-center text-2xl font-semibold text-foreground">
              {title}
            </Text>
            <Text className="mb-6 w-full max-w-sm text-center text-base text-muted-foreground">
              {subtitle}
            </Text>

            <View className="mb-1 w-full max-w-sm">
              {authExtrasReady ? (
                <>
                  {Platform.OS === 'ios' && (
                    <AppleSignInButton
                      disabled={formDisabled}
                      onSuccess={onOAuthSuccess}
                      onError={onOAuthError}
                    />
                  )}
                  <GoogleSignInButton
                    disabled={formDisabled}
                    onSuccess={onOAuthSuccess}
                    onError={onOAuthError}
                  />
                </>
              ) : (
                <View className="mb-2 h-12 w-full rounded-md bg-muted/40" />
              )}
            </View>

            <AuthDivider />

            <View className={cn('w-full max-w-sm', formClassName)}>{children}</View>

            {(error || success) && (
              <View className="mt-4 w-full max-w-sm">
                {error ? (
                  <Alert icon={AlertCircle} variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                {success ? (
                  <Alert icon={CheckCircle} variant="default">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                ) : null}
              </View>
            )}

            <Button
              onPress={primaryAction.onPress}
              disabled={formDisabled}
              size="lg"
              className="mt-4 h-12 w-full max-w-sm">
              {loading ? (
                <View className="flex-row items-center gap-2">
                  <Icon as={Loader2} size={20} className="animate-spin text-primary-foreground" />
                  <Text className="text-base font-medium text-primary-foreground">
                    {primaryAction.loadingLabel}
                  </Text>
                </View>
              ) : (
                <Text className="text-base font-medium text-primary-foreground">
                  {primaryAction.label}
                </Text>
              )}
            </Button>

            {showLegalNotice ? (
              <View className="w-full max-w-sm">
                <AuthLegalNotice />
              </View>
            ) : null}

            <View className="mt-8 w-full max-w-sm">{footer}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
