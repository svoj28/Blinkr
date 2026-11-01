import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type ProfileEdits, useProfile, useUpdateProfile } from '@/api/profiles';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen, scrollColumn } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/screen-states';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Avatars, getAvatar } from '@/constants/avatars';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { pickImage } from '@/lib/images';
import { useAuth } from '@/state/auth-context';
import type { ProfileDetails } from '@/types';
import { getInitials } from '@/utils/format';

/** Avatar colors to pick from (the same set new accounts get one of). */
const AVATAR_COLORS = [
  '#B45309', '#C2410C', '#9F1239', '#BE185D', '#6D28D9', '#1D4ED8',
  '#0369A1', '#0F766E', '#15803D', '#A16207', '#475569', '#2F5597',
];

const USERNAME = /^[a-z0-9_]{3,20}$/;

/** Edit your avatar (a photo, a built-in icon or initials), name, username, bio, location and avatar color. */
export default function EditProfileScreen() {
  const { userId } = useAuth();
  const profile = useProfile(userId);

  if (profile.isPending) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState message="Loading your profile…" />
      </Screen>
    );
  }
  if (!profile.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="We couldn’t load your profile." onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  return <EditProfileForm profile={profile.data} />;
}

function EditProfileForm({ profile }: { profile: ProfileDetails }) {
  const theme = useTheme();
  const { gutter } = useLayout();
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState<ProfileEdits>({
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    location: profile.location,
    avatarColor: profile.avatarColor,
    avatar: profile.avatar,
    photo: null,
  });
  const set = (changes: Partial<ProfileEdits>) => setForm((current) => ({ ...current, ...changes }));

  const username = form.username.trim().toLowerCase();
  const errors = {
    displayName: form.displayName.trim().length === 0 ? 'Your name can’t be empty.' : undefined,
    username: USERNAME.test(username) ? undefined : '3–20 characters: letters, numbers and _ only.',
  };
  const hasChanges =
    username !== profile.username ||
    form.displayName.trim() !== profile.displayName ||
    form.bio.trim() !== profile.bio ||
    form.location.trim() !== profile.location ||
    form.avatarColor !== profile.avatarColor ||
    form.avatar !== profile.avatar ||
    !!form.photo;
  const canSave = hasChanges && !errors.displayName && !errors.username && !updateProfile.isPending;

  // An uploaded photo is any avatar that isn't a built-in icon; a newly picked one shows before saving.
  const currentPhoto = form.photo?.uri ?? (form.avatar && !getAvatar(form.avatar) ? form.avatar : null);

  const choosePhoto = async () => {
    try {
      const photo = await pickImage({ square: true });
      if (photo) set({ photo });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Couldn’t use that photo', message);
    }
  };

  const save = () => {
    if (canSave) updateProfile.mutate(form, { onSuccess: () => router.back() });
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button title={updateProfile.isPending ? 'Saving…' : 'Save'} icon="checkmark" onPress={save} disabled={!canSave} />
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[scrollColumn, styles.scroll, { paddingHorizontal: gutter }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {/* Live preview of how you'll look on Blinks and in chats. */}
          <View style={styles.preview}>
            <Avatar
              user={{
                displayName: form.displayName.trim() || profile.displayName,
                avatarColor: form.avatarColor,
                avatar: form.photo?.uri ?? form.avatar,
              }}
              size={88}
            />
            <ThemedText variant="heading" numberOfLines={1}>
              {form.displayName.trim() || profile.displayName}
            </ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              @{username || profile.username}
            </ThemedText>
          </View>

          {/* Your own photo (up to 5 MB, cropped square), a built-in icon, or "Initials" from your name. */}
          <View style={styles.section}>
            <ThemedText variant="label" color="textSecondary">
              Avatar
            </ThemedText>
            <View style={styles.avatars} accessibilityRole="radiogroup">
              <AvatarOption
                label={currentPhoto ? 'Change photo' : 'Upload photo'}
                isSelected={!!currentPhoto}
                color={form.avatarColor}
                onPress={choosePhoto}>
                {currentPhoto ? (
                  <Image source={{ uri: currentPhoto }} style={StyleSheet.absoluteFill} />
                ) : (
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                )}
              </AvatarOption>
              <AvatarOption
                label="Initials"
                isSelected={form.avatar === null && !form.photo}
                color={form.avatarColor}
                onPress={() => set({ avatar: null, photo: null })}>
                <Text style={styles.optionInitials}>{getInitials(form.displayName.trim() || profile.displayName)}</Text>
              </AvatarOption>
              {Avatars.map((avatar) => (
                <AvatarOption
                  key={avatar.id}
                  label={avatar.label}
                  isSelected={form.avatar === avatar.id && !form.photo}
                  color={form.avatarColor}
                  onPress={() => set({ avatar: avatar.id, photo: null })}>
                  <Ionicons name={avatar.icon} size={24} color="#FFFFFF" />
                </AvatarOption>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText variant="label" color="textSecondary">
              Background color
            </ThemedText>
            <View style={styles.colors} accessibilityRole="radiogroup">
              {AVATAR_COLORS.map((color) => {
                const isSelected = color.toLowerCase() === form.avatarColor.toLowerCase();
                return (
                  <Pressable
                    key={color}
                    onPress={() => set({ avatarColor: color })}
                    accessibilityRole="radio"
                    accessibilityLabel={`Avatar color ${color}`}
                    accessibilityState={{ checked: isSelected }}
                    hitSlop={4}
                    style={[styles.swatch, { backgroundColor: color, borderColor: isSelected ? theme.text : 'transparent' }]}>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Card style={styles.form}>
            <TextField
              label="Name"
              value={form.displayName}
              onChangeText={(displayName) => set({ displayName })}
              maxLength={50}
              autoComplete="name"
              textContentType="name"
              error={errors.displayName}
            />
            <TextField
              label="Username"
              value={form.username}
              onChangeText={(value) => set({ username: value.replace(/^@/, '') })}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              error={errors.username}
              hint="People can find you by this. Your old username stops working."
            />
            <TextField
              label="Bio"
              value={form.bio}
              onChangeText={(bio) => set({ bio })}
              placeholder="A line about you"
              maxLength={160}
              multiline
              style={styles.bio}
              hint={`${160 - form.bio.length} characters left`}
            />
            <TextField
              label="Location"
              value={form.location}
              onChangeText={(location) => set({ location })}
              placeholder="City, country"
              maxLength={50}
              autoComplete="off"
            />
            {updateProfile.error && (
              <ThemedText variant="caption" color="danger" accessibilityRole="alert">
                {updateProfile.error.message}
              </ThemedText>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type AvatarOptionProps = {
  label: string;
  isSelected: boolean;
  color: string;
  onPress: () => void;
  children: ReactNode;
};

/** One choice in the avatar grid, drawn on your current color so you see the result. */
function AvatarOption({ label, isSelected, color, onPress, children }: AvatarOptionProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${label} avatar`}
      accessibilityState={{ checked: isSelected }}
      style={({ pressed }) => [
        styles.option,
        { borderColor: isSelected ? theme.tint : 'transparent', opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.optionInner, { backgroundColor: color }]}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  option: { width: 52, height: 52, borderRadius: Radius.md + 3, borderWidth: 3, padding: 2 },
  optionInner: { flex: 1, borderRadius: Radius.md - 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  optionInitials: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 14 },
  scroll: { paddingTop: Spacing.lg, paddingBottom: Spacing.xxl * 2, gap: Spacing.xl },
  preview: { alignItems: 'center', gap: Spacing.xs },
  section: { gap: Spacing.sm },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { padding: Spacing.lg, gap: Spacing.lg },
  bio: { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 },
});
