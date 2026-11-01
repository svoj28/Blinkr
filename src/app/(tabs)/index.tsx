import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useFeed } from '@/api/blinks';
import { useUnreadNotificationCount } from '@/api/notifications';
import { AppHeader, HeaderIconButton } from '@/components/app-header';
import { BlinkCard } from '@/components/blink-card';
import { BlinkSkeletonList } from '@/components/blink-skeleton';
import { EnterItem } from '@/components/motion';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';

export default function FeedScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const feed = useFeed();
  const { data: unread = 0 } = useUnreadNotificationCount();

  const blinks = feed.data?.pages.flat() ?? [];

  // Dateline under the wordmark, e.g. "Saturday, September 19"
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const bell = (
    <HeaderIconButton
      icon="notifications-outline"
      label="Notifications"
      badge={unread}
      onPress={() => router.navigate('/notifications')}
    />
  );

  return (
    <Screen>
      <AppHeader subtitle={today} right={bell} />

      <View style={contentColumn}>
        {feed.isPending && <BlinkSkeletonList />}

        {feed.isError && !feed.data && (
          <ErrorState message="We couldn’t load your Blink feed." onRetry={() => feed.refetch()} />
        )}

        {feed.data && (
          <FlatList
            data={blinks}
            keyExtractor={(blink) => blink.id}
            renderItem={({ item, index }) => (
              <EnterItem index={index}>
                <BlinkCard blink={item} onPress={() => router.push(`/blink/${item.id}`)} />
              </EnterItem>
            )}
            ListHeaderComponent={
              blinks.length > 0 ? (
                <ThemedText variant="label" color="textSecondary" style={{ paddingHorizontal: gutter, paddingBottom: Spacing.md }}>
                  Latest Blinks
                </ThemedText>
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={theme.tint} />
            }
            onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
            onEndReachedThreshold={0.5}
            ListFooterComponent={feed.isFetchingNextPage ? <LoadingState message="Loading more Blinks…" /> : null}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="newspaper-outline"
                title="No Blinks yet"
                message="Be the first to post. Your Blinks and everyone else’s will show up here."
                actionLabel="Create a Blink"
                onAction={() => router.navigate('/create')}
              />
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingBottom: Spacing.sm },
});
