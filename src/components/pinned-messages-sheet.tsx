import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sheetIn } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Message } from '@/types';
import { formatChatTimestamp } from '@/utils/format';

type PinnedMessagesSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Newest first, like the chat. */
  pins: Message[];
  myId: string | null;
  otherName: string;
  /** Scrolls the chat to this message (the sheet closes first). */
  onJump: (message: Message) => void;
  onUnpin: (message: Message) => void;
};

/** Every pinned message in a chat, with who sent it and when. Slides up from the bottom. */
export function PinnedMessagesSheet({ visible, onClose, pins, myId, otherName, onJump, onUnpin }: PinnedMessagesSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close pinned messages" />
      <Animated.View
        entering={sheetIn}
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.md },
        ]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <ThemedText variant="bodyStrong" style={styles.title}>
          {pins.length === 1 ? '1 pinned message' : `${pins.length} pinned messages`}
        </ThemedText>

        <ScrollView style={styles.list}>
          {pins.map((message) => (
            <View key={message.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <Pressable
                onPress={() => onJump(message)}
                accessibilityRole="button"
                accessibilityHint="Shows this message in the chat"
                style={({ pressed }) => [styles.rowBody, pressed && { opacity: 0.7 }]}>
                <ThemedText variant="caption" color="textSecondary">
                  {message.senderId === myId ? 'You' : otherName} · {formatChatTimestamp(message.createdAt)}
                </ThemedText>
                <ThemedText numberOfLines={3}>{message.text || '📷 Photo'}</ThemedText>
                {message.pinnedAt && (
                  <ThemedText variant="caption" color="textSecondary" style={styles.pinnedOn}>
                    Pinned {formatChatTimestamp(message.pinnedAt)}
                  </ThemedText>
                )}
              </Pressable>
              <Pressable onPress={() => onUnpin(message)} accessibilityRole="button" accessibilityLabel="Unpin message" hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.close, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.closeText, { color: theme.text }]}>Close</Text>
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
    maxHeight: '75%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  title: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  rowBody: { flex: 1, gap: 2 },
  pinnedOn: { fontSize: 11 },
  close: {
    marginTop: Spacing.sm,
    minHeight: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontFamily: Fonts.bold, fontSize: 15 },
});
