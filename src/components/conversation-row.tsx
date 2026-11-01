import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import type { ConversationPreview, ProfileSummary } from '@/types';
import { formatRelativeTime } from '@/utils/format';

type ConversationRowProps = {
  conversation: ConversationPreview;
  myId: string | null;
  onPress: () => void;
};

/** An inbox row. Unread conversations get bold text and a count badge. */
export function ConversationRow({ conversation, myId, onPress }: ConversationRowProps) {
  const theme = useTheme();
  const { gutter, avatarSize } = useLayout();
  const { otherUser, unreadCount } = conversation;

  const isUnread = unreadCount > 0;
  const preview = conversation.lastMessageText
    ? `${conversation.lastMessageSenderId === myId ? 'You: ' : ''}${conversation.lastMessageText}`
    : 'Say hello 👋';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${otherUser.displayName}${isUnread ? `, ${unreadCount} unread` : ''}`}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.surface : 'transparent' })}>
      <View style={[styles.row, { marginHorizontal: gutter, borderBottomColor: theme.border }]}>
        <Avatar user={otherUser} size={avatarSize} />
        <View style={styles.body}>
          <View style={styles.line}>
            <ThemedText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {otherUser.displayName}
            </ThemedText>
            <ThemedText variant={isUnread ? 'captionStrong' : 'caption'} color={isUnread ? 'tint' : 'textSecondary'}>
              {formatRelativeTime(conversation.lastMessageAt)}
            </ThemedText>
          </View>
          <View style={styles.line}>
            <ThemedText
              variant={isUnread ? 'captionStrong' : 'caption'}
              color={isUnread ? 'text' : 'textSecondary'}
              numberOfLines={1}
              style={styles.flex}>
              {preview}
            </ThemedText>
            {isUnread && (
              <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                <Text style={[styles.badgeText, { color: theme.onTint }]}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

type StartChatRowProps = {
  person: ProfileSummary;
  /** Shown after "@username" on the second line, e.g. "New this visit". */
  note?: string;
  isOpening?: boolean;
  onPress: () => void;
};

/** Someone you haven't messaged yet, styled like an inbox row. Tapping starts the chat. */
export function StartChatRow({ person, note, isOpening = false, onPress }: StartChatRowProps) {
  const theme = useTheme();
  const { gutter, avatarSize } = useLayout();

  return (
    <Pressable
      onPress={onPress}
      disabled={isOpening}
      accessibilityRole="button"
      accessibilityLabel={`Start a chat with ${person.displayName}`}
      accessibilityState={{ busy: isOpening }}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.surface : 'transparent' })}>
      <View style={[styles.row, { marginHorizontal: gutter, borderBottomColor: theme.border }]}>
        <Avatar user={person} size={avatarSize} />
        <View style={styles.body}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {person.displayName}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            {note ? `@${person.username} · ${note}` : `@${person.username}`}
          </ThemedText>
        </View>
        <View style={[styles.startButton, { backgroundColor: theme.tintSoft }]}>
          {isOpening ? (
            <ActivityIndicator size="small" color={theme.tint} />
          ) : (
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.tint} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  startButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  body: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: Fonts.bold, fontSize: 12 },
});
