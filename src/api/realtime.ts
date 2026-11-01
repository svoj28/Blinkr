import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { closedBlinkerKeys } from '@/api/closed-blinkers';
import { addMessageToCache, markMessagesDelivered, messageKeys, updateMessageInCache } from '@/api/messages';
import { notificationKeys } from '@/api/notifications';
import { type MessageRow, toMessage } from '@/api/rows';
import { supabase } from '@/lib/supabase';

/**
 * Listens for new messages and notifications while signed in, so chats, the inbox and
 * badges update live. Row-level security means you only receive your own rows.
 */
export function useRealtimeUpdates(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // While the app is open, anything sent to you counts as delivered.
    const markDelivered = () => {
      if (AppState.currentState === 'active') markMessagesDelivered().catch(() => {});
    };

    const channel = supabase
      .channel(`blinkr-live-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = toMessage(payload.new as MessageRow);
        addMessageToCache(queryClient, message);
        queryClient.invalidateQueries({ queryKey: messageKeys.inbox, exact: true });
        if (message.senderId !== userId) markDelivered();
      })
      // Read receipts and pins change existing messages.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        updateMessageInCache(queryClient, toMessage(payload.new as MessageRow));
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
          // A Closed Blinker request or acceptance: refresh those lists too.
          if (String((payload.new as { type?: string }).type).startsWith('closed_')) {
            queryClient.invalidateQueries({ queryKey: closedBlinkerKeys.all });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') markDelivered(); // catches up on messages sent while you were away
      });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') markDelivered();
    });

    return () => {
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
