import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { popIn } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type ConfirmDialogProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Round badge at the top. Ignored when `leading` is given. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Custom top element, e.g. the account's avatar. */
  leading?: ReactNode;
  tone?: 'danger' | 'default';
};

/**
 * A centered confirmation card in the Blinkr style (serif heading, hairline border,
 * pill buttons). Unlike the system alert, it matches the app and also works on the web.
 */
export function ConfirmDialog({
  visible,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon,
  leading,
  tone = 'default',
}: ConfirmDialogProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const accent = tone === 'danger' ? theme.danger : theme.tint;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" accessibilityLabel={cancelLabel} />
        <Animated.View
          entering={popIn}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              boxShadow: isDark ? '0 12px 32px rgba(0, 0, 0, 0.5)' : '0 12px 32px rgba(20, 22, 26, 0.16)',
            },
          ]}>
          {leading ??
            (icon && (
              <View style={[styles.badge, { backgroundColor: tone === 'danger' ? `${accent}1F` : theme.tintSoft }]}>
                <Ionicons name={icon} size={24} color={accent} />
              </View>
            ))}
          <ThemedText variant="heading" style={styles.center}>
            {title}
          </ThemedText>
          {message && (
            <ThemedText color="textSecondary" style={styles.center}>
              {message}
            </ThemedText>
          )}
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="secondary" onPress={onCancel} style={styles.action} />
            <Button
              title={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 10, 12, 0.5)' },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
  },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  center: { textAlign: 'center' },
  rule: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth * 2, marginTop: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch', marginTop: Spacing.xs },
  action: { flex: 1 },
});
