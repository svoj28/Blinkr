import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

/*
 * Who's active right now, using Supabase Realtime Presence (nothing is stored in the
 * database). While Blinkr is open in the foreground, each signed-in person is tracked on
 * one shared channel keyed by their user id; going to the background untracks them.
 */

let online: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setOnline(next: ReadonlySet<string>) {
  online = next;
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Ids of everyone active right now (including you). */
export function useOnlineUsers(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => online, () => online);
}

/** Call once while signed in (the tabs layout): marks you active and keeps the online list live. */
export function usePresenceTracking(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('blinkr-online', { config: { presence: { key: userId } } });
    const track = () => channel.track({ online_at: new Date().toISOString() }).catch(() => {});

    channel
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && AppState.currentState === 'active') track();
      });

    // Only count as active while the app is actually open.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') track();
      else channel.untrack().catch(() => {});
    });

    return () => {
      appState.remove();
      supabase.removeChannel(channel);
      setOnline(new Set());
    };
  }, [userId]);
}
