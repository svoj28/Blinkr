import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeIn.delay(150).duration(250)} // quick loads never flash a spinner
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message}>
      <ActivityIndicator size="large" color={theme.tint} />
      <ThemedText color="textSecondary">{message}</ThemedText>
    </Animated.View>
  );
}

function StateIcon({ icon, color, background }: { icon: IconName; color: string; background: string }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: background }]}>
      <Ionicons name={icon} size={28} color={color} />
    </View>
  );
}

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.container}>
      <StateIcon icon={icon} color={theme.tint} background={theme.tintSoft} />
      <ThemedText variant="heading" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText color="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} />}
    </Animated.View>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry: () => void;
};

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessibilityRole="alert">
      <StateIcon icon="cloud-offline-outline" color={theme.danger} background={theme.surface} />
      <ThemedText variant="heading" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText color="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      <Button title="Try again" icon="refresh" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  center: { textAlign: 'center', maxWidth: 320 },
});
