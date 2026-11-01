import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import type { AppNotification } from '@/types';
import { formatRelativeTime } from '@/utils/format';

const DESCRIPTIONS: Record<AppNotification['type'], { text: string; icon: ComponentProps<typeof Ionicons>['name'] }> = {
  like: { text: 'liked your Blink', icon: 'heart' },
  comment: { text: 'commented on your Blink', icon: 'chatbubble' },
  follow: { text: 'started following you', icon: 'person-add' },
  message: { text: 'sent you a message', icon: 'mail' },
  closed_request: { text: 'wants to add you as a Closed Blinker', icon: 'lock-closed' },
  closed_accept: { text: 'accepted your Closed Blinker request', icon: 'lock-closed' },
  call: { text: 'called you', icon: 'call' },
};

type NotificationRowProps = {
  notification: AppNotification;
  onPress: () => void;
};

/** "Jordan liked your Blink" — unread ones get a tinted background. */
export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { actor } = notification;
  const description = DESCRIPTIONS[notification.type];
  const isUnread = !notification.readAt;
  const iconColor = notification.type === 'like' ? theme.like : theme.tint;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${actor.displayName} ${description.text}, ${formatRelativeTime(notification.createdAt)}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.surface : isUnread ? theme.tintSoft : 'transparent',
      })}>
      <View style={[styles.row, { paddingHorizontal: gutter, borderBottomColor: theme.border }]}>
        <View>
          <Avatar user={actor} size={42} />
          <View style={[styles.typeBadge, { backgroundColor: theme.surface, borderColor: theme.background }]}>
            <Ionicons name={description.icon} size={12} color={iconColor} />
          </View>
        </View>
        <View style={styles.body}>
          <ThemedText>
            <ThemedText variant="bodyStrong">{actor.displayName}</ThemedText> {description.text}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {formatRelativeTime(notification.createdAt)}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  body: { flex: 1, gap: 2 },
  typeBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
