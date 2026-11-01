import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Built-in avatars (no photo uploads, no emoji): a white icon on your avatar color,
 * drawn with the same icon set as the rest of the app. No avatar picked shows initials.
 * Keep the ids in step with the profiles_avatar_check constraint in supabase/blinkr-schema.sql.
 */
export const Avatars = [
  { id: 'paw', icon: 'paw', label: 'Paw' },
  { id: 'leaf', icon: 'leaf', label: 'Leaf' },
  { id: 'flower', icon: 'flower', label: 'Flower' },
  { id: 'planet', icon: 'planet', label: 'Planet' },
  { id: 'rocket', icon: 'rocket', label: 'Rocket' },
  { id: 'moon', icon: 'moon', label: 'Moon' },
  { id: 'sunny', icon: 'sunny', label: 'Sun' },
  { id: 'star', icon: 'star', label: 'Star' },
  { id: 'flame', icon: 'flame', label: 'Flame' },
  { id: 'snow', icon: 'snow', label: 'Snowflake' },
  { id: 'musical-notes', icon: 'musical-notes', label: 'Music' },
  { id: 'headset', icon: 'headset', label: 'Headset' },
  { id: 'game-controller', icon: 'game-controller', label: 'Games' },
  { id: 'football', icon: 'football', label: 'Football' },
  { id: 'basketball', icon: 'basketball', label: 'Basketball' },
  { id: 'bicycle', icon: 'bicycle', label: 'Bicycle' },
  { id: 'airplane', icon: 'airplane', label: 'Travel' },
  { id: 'camera', icon: 'camera', label: 'Camera' },
  { id: 'cafe', icon: 'cafe', label: 'Coffee' },
  { id: 'pizza', icon: 'pizza', label: 'Pizza' },
  { id: 'fish', icon: 'fish', label: 'Fish' },
  { id: 'diamond', icon: 'diamond', label: 'Diamond' },
  { id: 'color-palette', icon: 'color-palette', label: 'Art' },
  { id: 'trophy', icon: 'trophy', label: 'Trophy' },
] as const satisfies readonly { id: string; icon: IconName; label: string }[];

export type AvatarId = (typeof Avatars)[number]['id'];

/** The built-in avatar for an id, or undefined for none/unknown (shows initials). */
export function getAvatar(id: string | null | undefined) {
  return id ? Avatars.find((avatar) => avatar.id === id) : undefined;
}
