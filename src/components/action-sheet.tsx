import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sheetIn } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SheetAction = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  tone?: 'danger';
};

type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
};

/** A menu that slides up from the bottom (the "⋯" menu on a Blink). */
export function ActionSheet({ visible, onClose, title, subtitle, actions }: ActionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const choose = (action: SheetAction) => {
    onClose();
    // iOS can't show an alert while a modal is still closing, so wait for it.
    setTimeout(action.onPress, Platform.OS === 'ios' ? 350 : 0);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
      <Animated.View
        entering={sheetIn}
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.md },
        ]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        {(title || subtitle) && (
          <View style={styles.heading}>
            {title && (
              <ThemedText variant="bodyStrong" numberOfLines={1}>
                {title}
              </ThemedText>
            )}
            {subtitle && (
              <ThemedText variant="caption" color="textSecondary" numberOfLines={2}>
                {subtitle}
              </ThemedText>
            )}
          </View>
        )}
        {actions.map((action) => {
          const color = action.tone === 'danger' ? theme.danger : theme.text;
          return (
            <Pressable
              key={action.key}
              onPress={() => choose(action)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.tintSoft }]}>
              <Ionicons name={action.icon} size={21} color={color} />
              <Text style={[styles.itemLabel, { color }]}>{action.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cancel, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 10, 12, 0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  heading: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  itemLabel: { fontFamily: Fonts.semibold, fontSize: 16 },
  cancel: {
    marginTop: Spacing.sm,
    minHeight: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: Fonts.bold, fontSize: 15 },
});
