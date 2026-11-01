import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { useFollowList } from '@/api/profiles';
import { EnterItem } from '@/components/motion';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { UnderlineTabs } from '@/components/underline-tabs';
import { UserRow } from '@/components/user-row';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

type FriendsTab = 'friends' | 'following' | 'followers';

const EMPTY: Record<FriendsTab, { title: string; message: string }> = {
  friends: {
    title: 'No friends yet',
    message: 'Friends are people you follow who follow you back. Find someone to follow to get started.',
  },
  following: { title: 'You’re not following anyone', message: 'Follow people to see their Blinks in your feed.' },
  followers: { title: 'No followers yet', message: 'Post a Blink or two. People who follow you will show up here.' },
};

/** Your people: friends (you follow each other), who you follow, and who follows you. */
export default function FriendsScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const [tab, setTab] = useState<FriendsTab>('friends');

  const following = useFollowList(userId, 'following');
  const followers = useFollowList(userId, 'followers');
  const friends = followers.data?.filter((person) => person.followedByMe);

  const lists = { friends, following: following.data, followers: followers.data };
  const source = tab === 'following' ? following : followers;
  const data = lists[tab];

  const count = (n: number | undefined) => (n === undefined ? '' : ` ${n}`);
  const tabs: { key: FriendsTab; label: string }[] = [
    { key: 'friends', label: `Friends${count(friends?.length)}` },
    { key: 'following', label: `Following${count(following.data?.length)}` },
    { key: 'followers', label: `Followers${count(followers.data?.length)}` },
  ];

  const refresh = () => {
    following.refetch();
    followers.refetch();
  };

  return (
    <Screen edges={['bottom']}>
      <View style={contentColumn}>
        <View style={{ paddingHorizontal: gutter, paddingTop: Spacing.sm }}>
          <UnderlineTabs tabs={tabs} active={tab} onChange={setTab} />
        </View>

        {source.isPending ? (
          <LoadingState message="Loading your people…" />
        ) : source.isError && !data ? (
          <ErrorState message="We couldn’t load this list." onRetry={() => source.refetch()} />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(person) => person.id}
            renderItem={({ item, index }) => (
              <EnterItem index={index}>
                <UserRow user={item} />
              </EnterItem>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title={EMPTY[tab].title}
                message={EMPTY[tab].message}
                actionLabel={tab === 'followers' ? undefined : 'Find people'}
                onAction={() => router.navigate('/search')}
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={following.isRefetching || followers.isRefetching}
                onRefresh={refresh}
                tintColor={theme.tint}
              />
            }
            contentContainerStyle={{ flexGrow: 1, paddingVertical: Spacing.md }}
          />
        )}
      </View>
    </Screen>
  );
}
