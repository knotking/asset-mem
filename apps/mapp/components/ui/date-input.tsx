import * as React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  View,
  useColorScheme,
  type ViewProps,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format, isValid, parse } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { getAppThemeColors } from '@/lib/css-theme-tokens';

function parseIsoDate(value: string): Date {
  const parsed = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : new Date();
}

function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

type DateInputProps = Omit<ViewProps, 'children'> & {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

function DateInput({ value, onChange, className, disabled, ...props }: DateInputProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = getAppThemeColors(isDark).background;
  const [showIosPicker, setShowIosPicker] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState(() => parseIsoDate(value));

  React.useEffect(() => {
    setDraftDate(parseIsoDate(value));
  }, [value]);

  const handleAndroidChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      onChange(toIsoDate(selectedDate));
    }
  };

  const openPicker = () => {
    if (disabled) return;
    const current = parseIsoDate(value);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        display: 'default',
        onChange: handleAndroidChange,
      });
      return;
    }
    setDraftDate(current);
    setShowIosPicker(true);
  };

  const commitDate = (date: Date) => {
    onChange(toIsoDate(date));
    setShowIosPicker(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select date"
        disabled={disabled}
        onPress={openPicker}
        className={cn(
          'h-10 flex-row items-center justify-between rounded-md border border-input bg-background px-3 shadow-sm shadow-black/5 dark:bg-input/30',
          disabled && 'opacity-50',
          className
        )}
        {...props}>
        <Text className="text-base text-foreground">
          {format(parseIsoDate(value), 'MMM d, yyyy')}
        </Text>
        <Icon as={Calendar} size={18} className="text-muted-foreground opacity-70" />
      </Pressable>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showIosPicker}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowIosPicker(false)}>
          <View className="flex-1 justify-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss date picker"
              className="absolute inset-0 bg-black/50"
              onPress={() => setShowIosPicker(false)}
            />
            <View
              style={{
                backgroundColor,
                paddingBottom: Math.max(insets.bottom, 12),
              }}>
              <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
                <Button variant="ghost" onPress={() => setShowIosPicker(false)}>
                  <Text>Cancel</Text>
                </Button>
                <Button variant="ghost" onPress={() => commitDate(draftDate)}>
                  <Text className="font-semibold text-primary">Done</Text>
                </Button>
              </View>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display="spinner"
                themeVariant={isDark ? 'dark' : 'light'}
                onChange={(_event, selectedDate) => {
                  if (selectedDate) setDraftDate(selectedDate);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export { DateInput, parseIsoDate, toIsoDate };
