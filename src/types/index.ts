import type { AvatarId } from '@/constants/avatars';
import type { MoodId } from '@/constants/moods';

/** The bits of a profile shown next to content (avatar, name, handle). */
export type ProfileSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  /** A built-in avatar id, the address of an uploaded photo, or null to show initials. */
  avatar: AvatarId | string | null;
};

export type Profile = ProfileSummary & {
  bio: string;
  location: string;
  createdAt: string;
};

/** A profile plus counts, as shown on profile screens. */
export type ProfileDetails = Profile & {
  blinkCount: number;
  followerCount: number;
  followingCount: number;
  followedByMe: boolean;
};

/** Blinks are text plus an optional mood, and disappear after their lifetime (max 3 days). */
export type Blink = {
  id: string;
  author: ProfileSummary;
  text: string;
  mood: MoodId | null;
  /** How long it stays up, in hours (1-72). */
  lifetimeHours: number;
  /** ISO date string; after this the Blink is gone for everyone. */
  expiresAt: string;
  /** ISO date string, or null if never edited. */
  editedAt: string | null;
  /** ISO date string. */
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /** Path of its photo in the blink-images bucket, if it has one. */
  imagePath: string | null;
};

export type Comment = {
  id: string;
  blinkId: string;
  author: ProfileSummary;
  text: string;
  createdAt: string;
};

/** A row in the Messages inbox. */
export type ConversationPreview = {
  id: string;
  otherUser: ProfileSummary;
  lastMessageText: string | null;
  lastMessageSenderId: string | null;
  lastMessageAt: string;
  unreadCount: number;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  /** When the recipient's app received it while open. */
  deliveredAt: string | null;
  readAt: string | null;
  /** Only on your own message while it's still on its way to the server. */
  pending?: boolean;
  /** Path of its photo in the private message-images bucket (Closed Blinkers only). */
  imagePath: string | null;
  /** The photo on this phone while it's still uploading. */
  localImageUri?: string;
  /** Set while the message is pinned (chats between Closed Blinkers only). */
  pinnedAt: string | null;
};

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'message'
  | 'closed_request'
  | 'closed_accept'
  | 'call';

export type ClosedBlinkerStatus = 'pending' | 'accepted';

/** Someone in your Closed Blinkers circle, or a request to join it. Separate from follows. */
export type ClosedBlinker = {
  user: ProfileSummary;
  status: ClosedBlinkerStatus;
  /** "incoming": they asked you. "outgoing": you asked them. */
  direction: 'incoming' | 'outgoing';
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  actor: ProfileSummary;
  blinkId: string | null;
  conversationId: string | null;
  createdAt: string;
  readAt: string | null;
};
