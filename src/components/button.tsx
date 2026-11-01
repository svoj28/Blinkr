import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/motion';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  /** Shows a spinner in place of the icon and blocks presses. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const fill = variant === 'primary' ? theme.tint : variant === 'danger' ? theme.danger : null;
  const foreground = fill ? theme.onTint : theme.text;
  const inactive = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: fill ?? theme.surface, borderColor: fill ?? theme.border, opacity: disabled ? 0.4 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        icon && <Ionicons name={icon} size={17} color={foreground} />
      )}
      <Text style={[styles.text, { color: foreground }]}>{title}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  text: { fontFamily: Fonts.bold, fontSize: 15 },
});
