import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = {
  children: ReactNode;
  /** Styles for the card itself (padding, layout). */
  style?: StyleProp<ViewStyle>;
  /** Card fill. Defaults to the theme surface color. */
  color?: string;
  /** Draws a slim colored edge on the left, e.g. the author's accent color. */
  accentColor?: string;
  radius?: number;
  /** Adds a soft shadow so the card floats above the page. */
  elevated?: boolean;
  /** Pressed feedback: the card dims slightly. */
  pressed?: boolean;
};

/** The base Blinkr surface: a quiet card with a hairline border and optional accent edge. */
export function Card({
  children,
  style,
  color,
  accentColor,
  radius = Radius.lg,
  elevated = false,
  pressed = false,
}: CardProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      style={[
        {
          backgroundColor: color ?? theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: radius,
          opacity: pressed ? 0.85 : 1,
        },
        accentColor && { borderLeftWidth: 4, borderLeftColor: accentColor },
        elevated && {
          boxShadow: isDark
            ? '0 6px 18px rgba(0, 0, 0, 0.45)'
            : '0 1px 2px rgba(20, 22, 26, 0.05), 0 6px 18px rgba(20, 22, 26, 0.07)',
        },
        style,
      ]}>
      {children}
    </View>
  );
}
