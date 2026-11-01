import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { cleanSearchTerm, currentUserId, toBlink } from '@/api/rows';
import type { MoodId } from '@/constants/moods';
import { newImagePath, type PickedImage, removeImage, uploadImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import type { Blink } from '@/types';

const FEED_PAGE_SIZE = 20;

/** Every Blink list lives under ['blinks', ...] so a like can update all of them at once. */
export const blinkKeys = {
  all: ['blinks'] as const,
  feed: ['blinks', 'feed'] as const,
  detail: (id: string) => ['blinks', 'detail', id] as const,
  byUser: (userId: string) => ['blinks', 'user', userId] as const,
  liked: ['blinks', 'liked'] as const,
  search: (term: string) => ['blinks', 'search', term] as const,
  trending: ['blinks', 'trending'] as const,
};

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The main feed: newest Blinks from everyone, 20 at a time. */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: blinkKeys.feed,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase.from('blink_feed').select('*').order('created_at', { ascending: false }).limit(FEED_PAGE_SIZE);
      if (pageParam) query = query.lt('created_at', pageParam);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(toBlink);
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === FEED_PAGE_SIZE ? lastPage[lastPage.length - 1].createdAt : undefined,
  });
}

export function useBlink(id: string) {
  return useQuery({
    queryKey: blinkKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('blink_feed').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? toBlink(data) : null;
    },
  });
}

export function useUserBlinks(userId: string) {
  return useQuery({
    queryKey: blinkKeys.byUser(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blink_feed')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map(toBlink);
    },
  });
}

export function useLikedBlinks(enabled = true) {
  return useQuery({
    queryKey: blinkKeys.liked,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blink_feed')
        .select('*')
        .eq('liked_by_me', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map(toBlink);
    },
  });
}

export function useSearchBlinks(term: string) {
  const cleaned = cleanSearchTerm(term);
  return useQuery({
    queryKey: blinkKeys.search(cleaned),
    enabled: cleaned.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blink_feed')
        .select('*')
        .ilike('text', `%${cleaned}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data.map(toBlink);
    },
  });
}

/** Most used #hashtags in recent Blinks, weighted by likes. */
export function useTrendingTags(limit = 8) {
  return useQuery({
    queryKey: blinkKeys.trending,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blink_feed')
        .select('text, like_count')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const scores = new Map<string, number>();
      for (const row of data) {
        for (const tag of row.text.match(/#[A-Za-z]\w*/g) ?? []) {
          const key = tag.toLowerCase();
          scores.set(key, (scores.get(key) ?? 0) + 1 + row.like_count);
        }
      }
      return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag]) => tag);
    },
  });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** What you write when posting or editing a Blink. A photo can only be added when posting. */
export type BlinkDraft = { text: string; mood?: MoodId; lifetimeHours: number; image?: PickedImage | null };

export function useCreateBlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, mood, lifetimeHours, image }: BlinkDraft) => {
      const authorId = await currentUserId();
      // The photo goes up first (into your own folder), then the Blink that points to it.
      const imagePath = image ? newImagePath(authorId, image) : null;
      if (image && imagePath) await uploadImage('blink-images', imagePath, image);

      // The database works out when it expires from lifetime_hours (at most 72).
      const { error } = await supabase.from('blinks').insert({
        author_id: authorId,
        text: text.trim(),
        mood: mood ?? null,
        lifetime_hours: lifetimeHours,
        image_path: imagePath,
      });
      if (error) {
        await removeImage('blink-images', imagePath).catch(() => {});
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blinkKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

/** Edits your own Blink: its text, mood and lifetime (counted from when it was posted). */
export function useUpdateBlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text, mood, lifetimeHours }: BlinkDraft & { id: string }) => {
      const { data, error } = await supabase
        .from('blinks')
        .update({ text: text.trim(), mood: mood ?? null, lifetime_hours: lifetimeHours })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      // Row-level security returns no row (rather than an error) for someone else's Blink.
      if (!data || data.length === 0) throw new Error('You can only edit your own Blinks.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blinkKeys.all }),
  });
}

export function useDeleteBlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blink: Pick<Blink, 'id' | 'imagePath'>) => {
      const { error } = await supabase.from('blinks').delete().eq('id', blink.id);
      if (error) throw error;
      // The database also deletes the photo; doing it here too makes it immediate.
      await removeImage('blink-images', blink.imagePath).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blinkKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

/** Likes or unlikes a Blink. The heart updates instantly and rolls back if the save fails. */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blink: Blink) => {
      const userId = await currentUserId();
      const { error } = blink.likedByMe
        ? await supabase.from('likes').delete().eq('user_id', userId).eq('blink_id', blink.id)
        : await supabase.from('likes').insert({ user_id: userId, blink_id: blink.id });
      if (error) throw error;
    },
    onMutate: async (blink) => {
      await queryClient.cancelQueries({ queryKey: blinkKeys.all });
      const snapshot = queryClient.getQueriesData({ queryKey: blinkKeys.all });
      updateBlinkEverywhere(queryClient, blink.id, (current) => ({
        ...current,
        likedByMe: !blink.likedByMe,
        likeCount: current.likeCount + (blink.likedByMe ? -1 : 1),
      }));
      return { snapshot };
    },
    onError: (_error, _blink, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
  });
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

type BlinkCacheData = Blink | Blink[] | InfiniteData<Blink[]> | null | undefined;

/** Applies a change to one Blink in every cached list (feed, profile, search, details…). */
export function updateBlinkEverywhere(queryClient: QueryClient, id: string, change: (blink: Blink) => Blink) {
  queryClient.setQueriesData<BlinkCacheData>({ queryKey: blinkKeys.all }, (data) => {
    if (!data) return data;
    const apply = (blink: Blink) => (blink.id === id ? change(blink) : blink);
    if (Array.isArray(data)) {
      // Trending tags are plain strings; leave them alone.
      return typeof data[0] === 'object' ? data.map(apply) : data;
    }
    if ('pages' in data) return { ...data, pages: data.pages.map((page) => page.map(apply)) };
    return apply(data);
  });
}
