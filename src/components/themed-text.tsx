import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'captionStrong'
  | 'label'
  | 'italic';

export type ThemedTextProps = TextProps & {
  variant?: Variant;
  color?: ThemeColor;
};

/** Text that follows the Blinkr type scale (Newsreader serif + Manrope sans) and the theme. */
export function ThemedText({ variant = 'body', color = 'text', style, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[styles[variant], { color: theme[color] }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  /** The masthead. */
  display: { fontFamily: Fonts.serifBold, fontSize: 40, lineHeight: 44, letterSpacing: -0.6 },
  title: { fontFamily: Fonts.serif, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  heading: { fontFamily: Fonts.serif, fontSize: 21, lineHeight: 27 },
  body: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 18 },
  /** Small uppercase section label, like a newspaper section name. */
  label: { fontFamily: Fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' },
  italic: { fontFamily: Fonts.serifItalic, fontSize: 16, lineHeight: 22 },
});
