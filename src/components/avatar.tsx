import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getAvatar } from '@/constants/avatars';
import { Fonts } from '@/constants/theme';
import type { ProfileSummary } from '@/types';
import { getInitials } from '@/utils/format';

type AvatarProps = {
  user: Pick<ProfileSummary, 'displayName' | 'avatarColor'> & { avatar?: string | null };
  size?: number;
};

/**
 * A colored rounded square (a quieter alternative to the usual circle) showing the
 * person's built-in icon avatar, or their initials if they haven't picked one.
 */
export function Avatar({ user, size = 44 }: AvatarProps) {
  const avatar = getAvatar(user.avatar);
  // Anything that isn't a built-in avatar id is the address of an uploaded photo.
  const photo = !avatar && user.avatar ? user.avatar : null;

  return (
    <View
      accessibilityLabel={`${user.displayName}'s avatar`}
      style={[
        styles.shape,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: user.avatarColor },
      ]}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : avatar ? (
        <Ionicons name={avatar.icon} size={Math.round(size * 0.52)} color="#FFFFFF" />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{getInitials(user.displayName)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shape: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: '#FFFFFF', fontFamily: Fonts.bold, letterSpacing: 0.5 },
});
