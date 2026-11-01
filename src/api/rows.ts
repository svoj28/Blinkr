import type { AvatarId } from '@/constants/avatars';
import type { MoodId } from '@/constants/moods';
import { supabase } from '@/lib/supabase';
import type {
  AppNotification,
  Blink,
  Comment,
  ConversationPreview,
  Message,
  ProfileDetails,
  ProfileSummary,
} from '@/types';

/*
 * Database rows (snake_case, as Supabase returns them) and the functions that turn
 * them into the app's types (camelCase). Every screen goes through these mappers.
 */

/** Columns to select when embedding an author/actor profile. */
export const PROFILE_SUMMARY_COLUMNS = 'id, username, display_name, avatar_color, avatar';

type ProfileSummaryRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar: string | null;
};

export function toProfileSummary(row: ProfileSummaryRow): ProfileSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    avatar: row.avatar as AvatarId | null,
  };
}

type ProfileDetailsRow = ProfileSummaryRow & {
  bio: string;
  location: string;
  created_at: string;
  blink_count: number;
  follower_count: number;
  following_count: number;
  followed_by_me: boolean;
};

export function toProfileDetails(row: ProfileDetailsRow): ProfileDetails {
  return {
    ...toProfileSummary(row),
    bio: row.bio,
    location: row.location,
    createdAt: row.created_at,
    blinkCount: row.blink_count,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    followedByMe: row.followed_by_me,
  };
}

type BlinkFeedRow = {
  id: string;
  author_id: string;
  text: string;
  mood: string | null;
  lifetime_hours: number;
  expires_at: string;
  edited_at: string | null;
  created_at: string;
  author_username: string;
  author_display_name: string;
  author_avatar_color: string;
  author_avatar: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  image_path: string | null;
};

export function toBlink(row: BlinkFeedRow): Blink {
  return {
    id: row.id,
    author: {
      id: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      avatarColor: row.author_avatar_color,
      avatar: row.author_avatar as AvatarId | null,
    },
    text: row.text,
    mood: row.mood as MoodId | null,
    lifetimeHours: row.lifetime_hours,
    expiresAt: row.expires_at,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    likedByMe: row.liked_by_me,
    imagePath: row.image_path ?? null,
  };
}

type CommentRow = { id: string; blink_id: string; text: string; created_at: string; author: ProfileSummaryRow };

export function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    blinkId: row.blink_id,
    author: toProfileSummary(row.author),
    text: row.text,
    createdAt: row.created_at,
  };
}

type ConversationListRow = {
  id: string;
  last_message_at: string;
  other_user_id: string;
  other_username: string;
  other_display_name: string;
  other_avatar_color: string;
  other_avatar: string | null;
  last_message_text: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
};

export function toConversationPreview(row: ConversationListRow): ConversationPreview {
  return {
    id: row.id,
    otherUser: {
      id: row.other_user_id,
      username: row.other_username,
      displayName: row.other_display_name,
      avatarColor: row.other_avatar_color,
      avatar: row.other_avatar as AvatarId | null,
    },
    lastMessageText: row.last_message_text,
    lastMessageSenderId: row.last_message_sender_id,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
  };
}

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  pinned_at: string | null;
  image_path: string | null;
};

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? null,
    readAt: row.read_at,
    pinnedAt: row.pinned_at ?? null,
    imagePath: row.image_path ?? null,
  };
}

type NotificationRow = {
  id: string;
  type: AppNotification['type'];
  blink_id: string | null;
  conversation_id: string | null;
  created_at: string;
  read_at: string | null;
  actor: ProfileSummaryRow;
};

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    actor: toProfileSummary(row.actor),
    blinkId: row.blink_id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/** The signed-in user's id, for inserts. Throws if nobody is signed in. */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('You need to be signed in.');
  return id;
}

/** Removes characters that would break a Supabase filter string. */
export function cleanSearchTerm(term: string): string {
  return term.replace(/[%,()*\\]/g, ' ').trim();
}
