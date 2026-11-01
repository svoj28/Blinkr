import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { PROFILE_SUMMARY_COLUMNS, toProfileSummary } from '@/api/rows';
import { CALLS_UNSUPPORTED_MESSAGE, callsSupported, type CallKind } from '@/lib/call-session';
import { supabase } from '@/lib/supabase';
import type { ProfileSummary } from '@/types';

/*
 * Voice and video calls, only between accepted Closed Blinkers (the database checks this).
 * The calls table tracks each call's status; the media itself goes phone to phone.
 */

export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'missed' | 'cancelled' | 'ended';

export type Call = {
  id: string;
  kind: CallKind;
  status: CallStatus;
  caller: ProfileSummary;
  callee: ProfileSummary;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
};

export const callKeys = {
  detail: (id: string) => ['calls', id] as const,
};

type CallRow = {
  id: string;
  kind: CallKind;
  status: CallStatus;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  caller: Parameters<typeof toProfileSummary>[0];
  callee: Parameters<typeof toProfileSummary>[0];
};

function toCall(row: CallRow): Call {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    caller: toProfileSummary(row.caller),
    callee: toProfileSummary(row.callee),
    createdAt: row.created_at,
    answeredAt: row.answered_at,
    endedAt: row.ended_at,
  };
}

/** One call, kept live: status changes (answered, declined, ended…) arrive instantly. */
export function useCall(id: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`call-row-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, (payload) => {
        const row = payload.new as Partial<CallRow>;
        queryClient.setQueryData<Call | null>(callKeys.detail(id), (current) =>
          current
            ? {
                ...current,
                status: row.status ?? current.status,
                answeredAt: row.answered_at ?? current.answeredAt,
                endedAt: row.ended_at ?? current.endedAt,
              }
            : current
        );
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  return useQuery({
    queryKey: callKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select(
          `id, kind, status, created_at, answered_at, ended_at,
           caller:profiles!calls_caller_id_fkey(${PROFILE_SUMMARY_COLUMNS}),
           callee:profiles!calls_callee_id_fkey(${PROFILE_SUMMARY_COLUMNS})`
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toCall(data as unknown as CallRow) : null;
    },
  });
}

/** Accept, decline, cancel, give up ('missed') or hang up. */
export async function updateCall(id: string, status: CallStatus) {
  const { error } = await supabase.rpc('update_call', { target_call_id: id, new_status: status });
  if (error) throw error;
}

function showError(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(title, message);
}

/** Starts a call to a Closed Blinker and opens the call screen. */
export function useStartCall() {
  const [startingKind, setStartingKind] = useState<CallKind | null>(null);

  const start = async (person: ProfileSummary, kind: CallKind) => {
    if (startingKind) return;
    if (!callsSupported()) return showError('Can’t call yet', CALLS_UNSUPPORTED_MESSAGE);
    setStartingKind(kind);
    try {
      const { data, error } = await supabase.rpc('start_call', { callee: person.id, call_kind: kind });
      if (error) throw error;
      router.push(`/call/${data as string}`);
    } catch (error) {
      showError('Couldn’t start the call', error instanceof Error ? error.message : String(error));
    } finally {
      setStartingKind(null);
    }
  };

  return { start, startingKind };
}

/** While signed in, opens the incoming-call screen the moment a Closed Blinker calls. */
export function useIncomingCallListener(userId: string | null) {
  useEffect(() => {
    if (!userId || !callsSupported()) return;
    const channel = supabase
      .channel(`incoming-calls-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { id: string; status: CallStatus };
          if (row.status === 'ringing') router.push(`/call/${row.id}`);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
