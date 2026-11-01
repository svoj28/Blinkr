import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PROFILE_SUMMARY_COLUMNS, toProfileSummary } from '@/api/rows';
import { supabase } from '@/lib/supabase';
import type { ClosedBlinker, ClosedBlinkerStatus, ProfileSummary } from '@/types';

/*
 * Closed Blinkers: a private two-way circle, separate from following/followers.
 * People are added only by QR code or user id, and the other person accepts or rejects.
 * All changes go through database functions (see supabase/blinkr-schema.sql).
 */

export const closedBlinkerKeys = {
  all: ['closed-blinkers'] as const,
};

/** What a Blinkr QR code contains. The scanner also accepts a bare user id. */
const QR_PREFIX = 'blinkr:closed:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function closedBlinkerQrValue(userId: string): string {
  return QR_PREFIX + userId;
}

/** Returns the user id in a scanned QR code or typed UID, or null if it isn't one. */
export function parseClosedBlinkerCode(text: string): string | null {
  const trimmed = text.trim();
  const id = trimmed.toLowerCase().startsWith(QR_PREFIX) ? trimmed.slice(QR_PREFIX.length) : trimmed;
  return UUID.test(id) ? id.toLowerCase() : null;
}

type ClosedBlinkerRow = {
  status: ClosedBlinkerStatus;
  created_at: string;
  requester: Parameters<typeof toProfileSummary>[0];
  addressee: Parameters<typeof toProfileSummary>[0];
};

export type ClosedBlinkerLists = {
  /** Requests waiting for you to accept or reject. */
  incoming: ClosedBlinker[];
  /** Requests you sent that haven't been answered. */
  outgoing: ClosedBlinker[];
  accepted: ClosedBlinker[];
};

export function useClosedBlinkers(myId: string | null) {
  return useQuery({
    queryKey: closedBlinkerKeys.all,
    enabled: !!myId,
    queryFn: async (): Promise<ClosedBlinkerLists> => {
      const { data, error } = await supabase
        .from('closed_blinkers')
        .select(
          `status, created_at,
           requester:profiles!closed_blinkers_requester_id_fkey(${PROFILE_SUMMARY_COLUMNS}),
           addressee:profiles!closed_blinkers_addressee_id_fkey(${PROFILE_SUMMARY_COLUMNS})`
        )
        .order('created_at', { ascending: false });
      if (error) throw error;

      const lists: ClosedBlinkerLists = { incoming: [], outgoing: [], accepted: [] };
      for (const row of data as unknown as ClosedBlinkerRow[]) {
        const isMine = row.requester.id === myId;
        const entry: ClosedBlinker = {
          user: toProfileSummary(isMine ? row.addressee : row.requester),
          status: row.status,
          direction: isMine ? 'outgoing' : 'incoming',
          createdAt: row.created_at,
        };
        if (row.status === 'accepted') lists.accepted.push(entry);
        else lists[entry.direction].push(entry);
      }
      lists.accepted.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
      return lists;
    },
  });
}

/** Sends a request by user id. Resolves to 'accepted' if they had already asked you. */
export function useRequestClosedBlinker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetId: string) => {
      const { data, error } = await supabase.rpc('request_closed_blinker', { target_id: targetId });
      if (error) throw error;
      return data as ClosedBlinkerStatus;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: closedBlinkerKeys.all }),
  });
}

/** Accepts or rejects a request. Updates the lists instantly and rolls back if it fails. */
export function useRespondClosedBlinker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requester, accept }: { requester: ProfileSummary; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_closed_blinker', { requester: requester.id, accept });
      if (error) throw error;
    },
    onMutate: async ({ requester, accept }) => {
      await queryClient.cancelQueries({ queryKey: closedBlinkerKeys.all });
      const snapshot = queryClient.getQueryData<ClosedBlinkerLists>(closedBlinkerKeys.all);
      if (snapshot) {
        const request = snapshot.incoming.find((r) => r.user.id === requester.id);
        queryClient.setQueryData<ClosedBlinkerLists>(closedBlinkerKeys.all, {
          ...snapshot,
          incoming: snapshot.incoming.filter((r) => r.user.id !== requester.id),
          accepted: accept && request ? [{ ...request, status: 'accepted' }, ...snapshot.accepted] : snapshot.accepted,
        });
      }
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      if (context?.snapshot) queryClient.setQueryData(closedBlinkerKeys.all, context.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: closedBlinkerKeys.all }),
  });
}

/** Cancels a request you sent, or removes someone from your Closed Blinkers. */
export function useRemoveClosedBlinker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await supabase.rpc('remove_closed_blinker', { other_id: otherId });
      if (error) throw error;
    },
    onMutate: async (otherId) => {
      await queryClient.cancelQueries({ queryKey: closedBlinkerKeys.all });
      const snapshot = queryClient.getQueryData<ClosedBlinkerLists>(closedBlinkerKeys.all);
      if (snapshot) {
        const keep = (r: ClosedBlinker) => r.user.id !== otherId;
        queryClient.setQueryData<ClosedBlinkerLists>(closedBlinkerKeys.all, {
          incoming: snapshot.incoming,
          outgoing: snapshot.outgoing.filter(keep),
          accepted: snapshot.accepted.filter(keep),
        });
      }
      return { snapshot };
    },
    onError: (_error, _id, context) => {
      if (context?.snapshot) queryClient.setQueryData(closedBlinkerKeys.all, context.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: closedBlinkerKeys.all }),
  });
}
