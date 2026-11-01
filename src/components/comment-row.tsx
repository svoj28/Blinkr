import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import type { Comment } from '@/types';
import { formatRelativeTime } from '@/utils/format';

export function CommentRow({ comment }: { comment: Comment }) {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { author } = comment;

  return (
    <View style={[styles.row, { marginHorizontal: gutter, borderBottomColor: theme.border }]}>
      <Pressable
        onPress={() => router.push(`/user/${author.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`${author.displayName}'s profile`}>
        <Avatar user={author} size={34} />
      </Pressable>
      <View style={styles.body}>
        <ThemedText variant="captionStrong" numberOfLines={1}>
          {author.displayName}{' '}
          <ThemedText variant="caption" color="textSecondary">
            @{author.username} · {formatRelativeTime(comment.createdAt)}
          </ThemedText>
        </ThemedText>
        <ThemedText>{comment.text}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  body: { flex: 1, gap: 2 },
});
