import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ChatPhoto } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Message } from '@/types';
import { formatClockTime } from '@/utils/format';

type MessageBubbleProps = {
  message: Message;
  isMine: boolean;
  isPinned?: boolean;
  /** Opens the message's actions (pinning, in chats between Closed Blinkers). */
  onLongPress?: () => void;
};

/** Where your message is: on its way, stored, reached their open app, or read. */
function statusLabel(message: Message): string {
  if (message.pending) return 'Sending…';
  if (message.readAt) return 'Seen';
  if (message.deliveredAt) return 'Delivered';
  return 'Sent';
}

/** Only fresh messages animate in; opening a chat shows its history at once. */
const FRESH_MS = 10_000;

/** One chat message. Yours sit on the right in the accent color; theirs on the left. */
export function MessageBubble({ message, isMine, isPinned, onLongPress }: MessageBubbleProps) {
  const theme = useTheme();
  const hasPhoto = !!(message.imagePath || message.localImageUri);
  const isFresh = message.pending || Date.now() - new Date(message.createdAt).getTime() < FRESH_MS;

  return (
    <Animated.View
      entering={isFresh ? FadeInDown.springify().damping(18).stiffness(220) : undefined}
      style={[styles.row, isMine ? styles.mine : styles.theirs]}>
      <Pressable
        onLongPress={onLongPress}
        disabled={!onLongPress}
        accessibilityHint={onLongPress ? 'Long press for message options' : undefined}
        style={({ pressed }) => [
          styles.bubble,
          hasPhoto && styles.photoBubble,
          pressed && { opacity: 0.8 },
          isMine
            ? { backgroundColor: theme.tint, borderBottomRightRadius: 4 }
            : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderBottomLeftRadius: 4 },
        ]}>
        {hasPhoto && <ChatPhoto path={message.imagePath} localUri={message.localImageUri} style={styles.photo} />}
        {message.text.length > 0 && (
          <ThemedText style={[{ color: isMine ? theme.onTint : theme.text }, hasPhoto && styles.caption]}>
            {message.text}
          </ThemedText>
        )}
      </Pressable>
      <View style={styles.meta}>
        {isPinned && <Ionicons name="pin" size={11} color={theme.textSecondary} accessibilityLabel="Pinned" />}
        <ThemedText variant="caption" color="textSecondary" style={styles.time}>
          {formatClockTime(message.createdAt)}
          {isMine ? ` · ${statusLabel(message)}` : ''}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '82%', marginVertical: 3, gap: 2 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.lg },
  // A photo fills the bubble (inside a thin frame); any text sits under it.
  photoBubble: { width: 240, maxWidth: '100%', padding: 4, gap: 6 },
  photo: { borderRadius: Radius.md },
  caption: { paddingHorizontal: 10, paddingBottom: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: Spacing.xs },
  time: { fontSize: 11, lineHeight: 14 },
});
