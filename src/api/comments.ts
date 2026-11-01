import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { updateBlinkEverywhere } from '@/api/blinks';
import { currentUserId, PROFILE_SUMMARY_COLUMNS, toComment } from '@/api/rows';
import { supabase } from '@/lib/supabase';

export const commentKeys = {
  forBlink: (blinkId: string) => ['comments', blinkId] as const,
};

export function useComments(blinkId: string) {
  return useQuery({
    queryKey: commentKeys.forBlink(blinkId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select(`id, blink_id, text, created_at, author:profiles(${PROFILE_SUMMARY_COLUMNS})`)
        .eq('blink_id', blinkId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data.map((row) => toComment(row as unknown as Parameters<typeof toComment>[0]));
    },
  });
}

export function useAddComment(blinkId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from('comments')
        .insert({ blink_id: blinkId, author_id: await currentUserId(), text: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.forBlink(blinkId) });
      updateBlinkEverywhere(queryClient, blinkId, (blink) => ({ ...blink, commentCount: blink.commentCount + 1 }));
    },
  });
}
