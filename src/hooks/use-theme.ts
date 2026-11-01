/**
 * Returns the Blinkr color palette for the current light/dark mode, with the signed-in
 * person’s avatar color as the accent.
 * Learn more: https://docs.expo.dev/guides/color-schemes/
 */

import { createContext, useContext } from 'react';

import { getTheme, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The accent color (your avatar color), provided once in the root layout. Null: the default green. */
export const AccentContext = createContext<string | null>(null);

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  const accent = useContext(AccentContext);
  return getTheme(scheme, accent);
}
