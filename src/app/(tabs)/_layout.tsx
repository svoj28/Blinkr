import { Tabs } from 'expo-router/js-tabs';

import { useConversations } from '@/api/messages';
import { useUnreadNotificationCount } from '@/api/notifications';
import { usePresenceTracking } from '@/api/presence';
import { useRealtimeUpdates } from '@/api/realtime';
import { DrawerProvider } from '@/components/app-drawer';
import { DockTabBar } from '@/components/dock-tab-bar';
import { useAuth } from '@/state/auth-context';

/** The five main tabs, shown in Blinkr's floating dock (see DockTabBar for icons and styling). */
export default function TabLayout() {
  const { userId } = useAuth();
  useRealtimeUpdates(userId);
  usePresenceTracking(userId);

  const { data: conversations } = useConversations();
  const unreadMessages = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
  const { data: unreadNotifications = 0 } = useUnreadNotificationCount();

  return (
    // The side menu (opened from the avatar in each tab's header) slides in over the tabs and dock.
    <DrawerProvider>
      <Tabs tabBar={(props) => <DockTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
        <Tabs.Screen name="index" options={{ title: 'Feed' }} />
        <Tabs.Screen name="search" options={{ title: 'Search' }} />
        <Tabs.Screen name="create" options={{ title: 'Create', tabBarAccessibilityLabel: 'Create a Blink' }} />
        <Tabs.Screen
          name="messages"
          options={{ title: 'Messages', tabBarBadge: unreadMessages > 0 ? Math.min(unreadMessages, 99) : undefined }}
        />
        {/* Profile lives in the side menu (tap your avatar); Notifications took its place here. */}
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarAccessibilityLabel: 'Notifications',
            tabBarBadge: unreadNotifications > 0 ? Math.min(unreadNotifications, 99) : undefined,
          }}
        />
      </Tabs>
    </DrawerProvider>
  );
}
