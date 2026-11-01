import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { useMarkNotificationsRead, useNotifications } from '@/api/notifications';
import { AppHeader } from '@/components/app-header';
import { EnterItem } from '@/components/motion';
import { NotificationRow } from '@/components/notification-row';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { useTheme } from '@/hooks/use-theme';
import type { AppNotification } from '@/types';

/** Activity: who liked or commented on your Blinks, and who followed you. */
export default function NotificationsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const markAllRead = useMarkNotificationsRead();

  // Viewing this tab counts as reading them. They stay highlighted until you leave.
  // (Tabs stay mounted in the background, so only mark them read while it's on screen.)
  const isFocused = useIsFocused();
  const unreadCount = notifications.data?.filter((n) => !n.readAt).length ?? 0;
  useEffect(() => {
    if (isFocused && unreadCount > 0) markAllRead();
  }, [isFocused, unreadCount, markAllRead]);

  const header = (
    <AppHeader
      title="Notifications"
      subtitle={notifications.isSuccess ? (unreadCount > 0 ? `${unreadCount} new` : 'You’re all caught up') : undefined}
    />
  );

  const open = (notification: AppNotification) => {
    if (notification.type === 'closed_request' || notification.type === 'closed_accept') {
      router.push('/closed-blinkers');
    } else if (notification.type === 'follow') router.push(`/user/${notification.actor.id}`);
    else if (notification.blinkId) router.push(`/blink/${notification.blinkId}`);
  };

  if (notifications.isPending) {
    return (
      <Screen>
        {header}
        <LoadingState message="Loading notifications…" />
      </Screen>
    );
  }

  if (notifications.isError) {
    return (
      <Screen>
        {header}
        <ErrorState message="We couldn’t load your notifications." onRetry={() => notifications.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <View style={contentColumn}>
        <FlatList
          data={notifications.data}
          keyExtractor={(notification) => notification.id}
          renderItem={({ item, index }) => (
            <EnterItem index={index}>
              <NotificationRow notification={item} onPress={() => open(item)} />
            </EnterItem>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Nothing new yet"
              message="When people like or comment on your Blinks, or follow you, you’ll see it here."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={notifications.isRefetching}
              onRefresh={() => notifications.refetch()}
              tintColor={theme.tint}
            />
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      </View>
    </Screen>
  );
}
