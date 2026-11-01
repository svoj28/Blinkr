import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useToggleFollow } from '@/api/profiles';
import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import type { ProfileDetails } from '@/types';
import { formatCount } from '@/utils/format';

type UserRowProps = {
  user: ProfileDetails;
  /** Hide the Follow button on your own row. */
  isMe?: boolean;
};

/** A person with a Follow button. Tapping the row opens their profile. */
export function UserRow({ user, isMe = false }: UserRowProps) {
  const theme = useTheme();
  const { gutter, avatarSize } = useLayout();
  const toggleFollow = useToggleFollow();

  return (
    <Pressable
      onPress={() => router.push(`/user/${user.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${user.displayName}'s profile`}
      style={({ pressed }) => [styles.row, { paddingHorizontal: gutter, opacity: pressed ? 0.7 : 1 }]}>
      <Avatar user={user} size={avatarSize} />
      <View style={styles.text}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {user.displayName}
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
          @{user.username} · {formatCount(user.followerCount)} {user.followerCount === 1 ? 'follower' : 'followers'}
        </ThemedText>
      </View>
      {!isMe && (
        <Pressable
          onPress={() => toggleFollow.mutate(user)}
          accessibilityRole="button"
          accessibilityLabel={`${user.followedByMe ? 'Unfollow' : 'Follow'} ${user.displayName}`}
          hitSlop={6}
          style={({ pressed }) => [
            styles.follow,
            {
              borderColor: user.followedByMe ? theme.border : theme.tint,
              backgroundColor: user.followedByMe ? 'transparent' : theme.tint,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <Text style={[styles.followText, { color: user.followedByMe ? theme.text : theme.onTint }]}>
            {user.followedByMe ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
  text: { flex: 1 },
  follow: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: { fontFamily: Fonts.bold, fontSize: 14 },
});
