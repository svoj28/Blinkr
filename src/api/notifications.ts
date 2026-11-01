import { useQuery, useQueryClient } from '@tanstack/react-query';

import { PROFILE_SUMMARY_COLUMNS, toNotification } from '@/api/rows';
import { supabase } from '@/lib/supabase';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread'] as const,
};

// Message notifications are for push only; the Messages tab already shows them.
const ACTIVITY_TYPES = ['like', 'comment', 'follow', 'closed_request', 'closed_accept'];

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          `id, type, blink_id, conversation_id, created_at, read_at,
           actor:profiles!notifications_actor_id_fkey(${PROFILE_SUMMARY_COLUMNS})`
        )
        .in('type', ACTIVITY_TYPES)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data.map((row) => toNotification(row as unknown as Parameters<typeof toNotification>[0]));
    },
  });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in('type', ACTIVITY_TYPES)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('type', ACTIVITY_TYPES)
      .is('read_at', null);
    if (!error) queryClient.setQueryData(notificationKeys.unreadCount, 0);
  };
}
