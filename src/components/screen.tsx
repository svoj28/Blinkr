import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Tab screens only need the top edge; the tab bar already handles the bottom. */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

/** Full-screen container that respects notches and the themed background color. */
export function Screen({ children, edges = ['top'], style }: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.container, { backgroundColor: theme.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

/** Centers content and caps its width on large phones and tablets. */
export const contentColumn: ViewStyle = {
  flex: 1,
  width: '100%',
  maxWidth: MaxContentWidth,
  alignSelf: 'center',
};

/**
 * The same column for a ScrollView's contentContainerStyle. It grows with its content
 * (flexGrow, not flex: 1), so anything taller than the screen can scroll.
 */
export const scrollColumn: ViewStyle = {
  flexGrow: 1,
  width: '100%',
  maxWidth: MaxContentWidth,
  alignSelf: 'center',
};
