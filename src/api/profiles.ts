import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cleanSearchTerm, currentUserId, toProfileDetails } from '@/api/rows';
import type { AvatarId } from '@/constants/avatars';
import { newImagePath, type PickedImage, publicImageUrl, removeImage, uploadImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import type { ProfileDetails } from '@/types';

export const profileKeys = {
  all: ['profiles'] as const,
  detail: (id: string) => ['profiles', 'detail', id] as const,
  search: (term: string) => ['profiles', 'search', term] as const,
  suggested: ['profiles', 'suggested'] as const,
  follows: (id: string, direction: FollowDirection) => ['profiles', 'follows', direction, id] as const,
};

/** "followers": people who follow this user. "following": people this user follows. */
export type FollowDirection = 'followers' | 'following';

export function useProfile(id: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('profile_details').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data ? toProfileDetails(data) : null;
    },
  });
}

export function useSearchProfiles(term: string) {
  const cleaned = cleanSearchTerm(term.replace(/^@/, ''));
  return useQuery({
    queryKey: profileKeys.search(cleaned),
    enabled: cleaned.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_details')
        .select('*')
        .or(`username.ilike.%${cleaned}%,display_name.ilike.%${cleaned}%`)
        .order('follower_count', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data.map(toProfileDetails);
    },
  });
}

/** People you don't follow yet, most followed first. */
export function useSuggestedProfiles(myId: string | null) {
  return useQuery({
    queryKey: profileKeys.suggested,
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_details')
        .select('*')
        .eq('followed_by_me', false)
        .neq('id', myId!)
        .order('follower_count', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data.map(toProfileDetails);
    },
  });
}

/**
 * Someone's followers, or the people they follow, newest first.
 * Kept under profileKeys.all, so Follow buttons in these lists update instantly too.
 */
export function useFollowList(userId: string | null, direction: FollowDirection) {
  return useQuery({
    queryKey: profileKeys.follows(userId ?? '', direction),
    enabled: !!userId,
    queryFn: async () => {
      const isFollowers = direction === 'followers';
      const { data: follows, error } = await supabase
        .from('follows')
        .select('follower_id, following_id')
        .eq(isFollowers ? 'following_id' : 'follower_id', userId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const ids = follows.map((row) => (isFollowers ? row.follower_id : row.following_id) as string);
      if (ids.length === 0) return [];

      const { data, error: profilesError } = await supabase.from('profile_details').select('*').in('id', ids);
      if (profilesError) throw profilesError;
      const byId = new Map(data.map((row) => [row.id as string, toProfileDetails(row)]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },
  });
}

/** Follows or unfollows someone. Updates instantly and rolls back if the save fails. */
export function useToggleFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Pick<ProfileDetails, 'id' | 'followedByMe'>) => {
      const me = await currentUserId();
      const { error } = profile.followedByMe
        ? await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', profile.id)
        : await supabase.from('follows').insert({ follower_id: me, following_id: profile.id });
      if (error) throw error;
    },
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.all });
      const snapshot = queryClient.getQueriesData({ queryKey: profileKeys.all });
      const change = (p: ProfileDetails): ProfileDetails =>
        p.id === profile.id
          ? {
              ...p,
              followedByMe: !profile.followedByMe,
              followerCount: p.followerCount + (profile.followedByMe ? -1 : 1),
            }
          : p;
      queryClient.setQueriesData<ProfileDetails | ProfileDetails[] | null>({ queryKey: profileKeys.all }, (data) =>
        !data ? data : Array.isArray(data) ? data.map(change) : change(data)
      );
      return { snapshot };
    },
    onError: (_error, _profile, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      // My own "following" count changed too.
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/** The fields Edit profile can change (the database allows only these). */
export type ProfileEdits = {
  username: string;
  displayName: string;
  bio: string;
  location: string;
  avatarColor: string;
  /** Built-in avatar id, an uploaded photo's address, or null for initials. */
  avatar: AvatarId | string | null;
  /** A new photo to upload and use as the avatar (replaces `avatar`). */
  photo?: PickedImage | null;
};

/** Saves your own profile. A taken username comes back as a friendly error. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (edits: ProfileEdits) => {
      const userId = await currentUserId();
      let avatar = edits.avatar;
      let uploadedPath: string | null = null;
      if (edits.photo) {
        uploadedPath = newImagePath(userId, edits.photo);
        await uploadImage('avatars', uploadedPath, edits.photo);
        avatar = publicImageUrl('avatars', uploadedPath);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: edits.username.trim().toLowerCase(),
          display_name: edits.displayName.trim(),
          bio: edits.bio.trim(),
          location: edits.location.trim(),
          avatar_color: edits.avatarColor,
          avatar,
        })
        .eq('id', userId);
      if (error) {
        await removeImage('avatars', uploadedPath).catch(() => {});
        if (error.code === '23505') throw new Error('That username is taken. Try another one.');
        throw error;
      }
    },
    onSuccess: () => {
      // Names and colors appear on Blinks, chats and lists too.
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      queryClient.invalidateQueries({ queryKey: ['blinks'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** Used by sign-up to check a username before creating the account. */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { name: username });
  if (error) throw error;
  return data === true;
}
