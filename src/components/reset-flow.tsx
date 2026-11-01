import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/* Pieces shared by the forgot-password and reset-password screens. */

const STEP_COUNT = 3;

/** "Step 2 of 3" with short bars, the done ones in the accent color. */
export function ResetSteps({ current }: { current: 1 | 2 | 3 }) {
  const theme = useTheme();
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${current} of ${STEP_COUNT}`}>
      {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((n) => (
        <View key={n} style={[styles.stepBar, { backgroundColor: n <= current ? theme.tint : theme.border }]} />
      ))}
      <ThemedText variant="label" color="textSecondary">
        Step {current} of {STEP_COUNT}
      </ThemedText>
    </View>
  );
}

type ResetIntroProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  tone?: 'danger';
};

/** Icon badge, serif title and an italic line underneath. */
export function ResetIntro({ icon, title, message, tone }: ResetIntroProps) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : theme.tint;
  return (
    <View style={styles.intro}>
      <View style={[styles.badge, { backgroundColor: tone === 'danger' ? `${theme.danger}1F` : theme.tintSoft }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <ThemedText variant="title">{title}</ThemedText>
      <ThemedText variant="italic" color="textSecondary">
        {message}
      </ThemedText>
    </View>
  );
}

/** A red-outlined message inside a form. */
export function FormError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.error, { borderColor: theme.danger }]} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
      <ThemedText variant="caption" color="danger" style={styles.flex}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBar: { width: 28, height: 4, borderRadius: 2 },
  intro: { gap: Spacing.sm },
  badge: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  flex: { flex: 1 },
});
