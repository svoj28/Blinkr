import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** 0–3: length, then a mix of letters, numbers and symbols. Only a nudge; 6 characters is the minimum. */
function passwordStrength(password: string): number {
  if (password.length < 6) return password.length > 0 ? 1 : 0;
  const kinds = [/[a-z]/i, /\d/, /[^a-z\d]/i].filter((pattern) => pattern.test(password)).length;
  if (password.length >= 10 && kinds >= 2) return 3;
  return kinds >= 2 || password.length >= 10 ? 2 : 1;
}

const LABELS = ['', 'Weak', 'Good', 'Strong'];

/** Three bars under a new-password field. Hidden until something is typed. */
export function PasswordStrength({ password }: { password: string }) {
  const theme = useTheme();
  const strength = passwordStrength(password);
  if (strength === 0) return null;
  const color = strength === 1 ? theme.danger : strength === 2 ? theme.textSecondary : theme.tint;

  return (
    <View style={styles.row} accessibilityLabel={`Password strength: ${LABELS[strength]}`}>
      {[1, 2, 3].map((level) => (
        <View key={level} style={[styles.bar, { backgroundColor: level <= strength ? color : theme.border }]} />
      ))}
      <ThemedText variant="captionStrong" style={[styles.label, { color }]}>
        {LABELS[strength]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { width: 52, textAlign: 'right' },
});
