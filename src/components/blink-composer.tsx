import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { BlinkDraft } from '@/api/blinks';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { MoodBadge } from '@/components/mood-badge';
import { Photo } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { BlinkLifetimes, Moods, type MoodId } from '@/constants/moods';
import { Fonts, MaxBlinkLength, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pickImage } from '@/lib/images';
import type { ProfileSummary } from '@/types';

type BlinkComposerProps = {
  value: BlinkDraft;
  onChange: (draft: BlinkDraft) => void;
  author?: ProfileSummary | null;
  /** Editing: lifetimes count from this time, so ones that have already run out are disabled. */
  postedAt?: string;
  /** Offer "Add photo" (when posting; a photo can't be changed afterwards). */
  allowPhoto?: boolean;
};

/** A Blink needs text, a mood or a photo (any mix). */
export function canSubmitDraft(draft: BlinkDraft): boolean {
  return draft.text.trim().length > 0 || draft.mood !== undefined || !!draft.image;
}

/** The Blink editor: text, "Select a Mood", and how long it stays up (up to 3 days). */
export function BlinkComposer({ value, onChange, author, postedAt, allowPhoto = false }: BlinkComposerProps) {
  const theme = useTheme();
  const remaining = MaxBlinkLength - value.text.length;
  const set = (changes: Partial<BlinkDraft>) => onChange({ ...value, ...changes });

  const toggleMood = (id: MoodId) => set({ mood: value.mood === id ? undefined : id });

  const addPhoto = async () => {
    try {
      const image = await pickImage();
      if (image) set({ image });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Couldn’t add that photo', message);
    }
  };

  // When editing, the lifetime is counted from when the Blink was first posted.
  const postedTime = postedAt ? new Date(postedAt).getTime() : null;
  const isLifetimeOver = (hours: number) => postedTime !== null && postedTime + hours * 3_600_000 <= Date.now() + 60_000;

  return (
    <View style={styles.stack}>
      <Card elevated style={styles.composer}>
        {author && (
          <View style={styles.composerTop}>
            <Avatar user={author} size={40} />
            <ThemedText variant="bodyStrong">{author.displayName}</ThemedText>
          </View>
        )}

        <TextInput
          value={value.text}
          onChangeText={(text) => set({ text })}
          placeholder="What’s happening? Emojis welcome 😄"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={MaxBlinkLength}
          accessibilityLabel="Blink text"
          style={[styles.input, { color: theme.text }]}
        />

        {value.image && (
          <View>
            <Photo uri={value.image.uri} aspectRatio={value.image.width / value.image.height} expandable={false} />
            <Pressable
              onPress={() => set({ image: null })}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              hitSlop={8}
              style={[styles.removePhoto, { backgroundColor: theme.text, borderColor: theme.surface }]}>
              <Ionicons name="close" size={14} color={theme.background} />
            </Pressable>
          </View>
        )}

        {value.mood && (
          <View style={styles.selected}>
            <MoodBadge id={value.mood} large />
            <Pressable
              onPress={() => set({ mood: undefined })}
              accessibilityRole="button"
              accessibilityLabel="Remove mood"
              hitSlop={8}
              style={[styles.remove, { backgroundColor: theme.text, borderColor: theme.surface }]}>
              <Ionicons name="close" size={12} color={theme.background} />
            </Pressable>
          </View>
        )}

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          {allowPhoto && !value.image && (
            <Pressable
              onPress={addPhoto}
              accessibilityRole="button"
              accessibilityLabel="Add a photo, up to 5 MB"
              hitSlop={6}
              style={({ pressed }) => [styles.photoButton, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="image-outline" size={18} color={theme.tint} />
              <Text style={[styles.photoButtonText, { color: theme.tint }]}>Photo</Text>
            </Pressable>
          )}
          <ThemedText variant="caption" color="textSecondary" style={{ flex: 1 }}>
            Add #hashtags so people can find your Blink.
          </ThemedText>
          <Text
            style={[styles.counterText, { color: remaining <= 20 ? theme.danger : theme.textSecondary }]}
            accessibilityLabel={`${remaining} characters left`}>
            {remaining}
          </Text>
        </View>
      </Card>

      <View style={styles.section}>
        <ThemedText variant="label" color="textSecondary">
          Select a mood
        </ThemedText>
        <View style={styles.moodGrid}>
          {Moods.map((mood) => {
            const isSelected = mood.id === value.mood;
            return (
              <Pressable
                key={mood.id}
                onPress={() => toggleMood(mood.id)}
                accessibilityRole="button"
                accessibilityLabel={`Feeling ${mood.label.toLowerCase()}`}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.moodOption,
                  {
                    backgroundColor: isSelected ? theme.tintSoft : theme.surface,
                    borderColor: isSelected ? theme.tint : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.moodLabel,
                    { color: isSelected ? theme.text : theme.textSecondary, fontFamily: isSelected ? Fonts.bold : Fonts.medium },
                  ]}>
                  {mood.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText variant="label" color="textSecondary">
          Disappears after
        </ThemedText>
        <View style={styles.lifetimes} accessibilityRole="radiogroup">
          {BlinkLifetimes.map((option) => {
            const isSelected = option.hours === value.lifetimeHours;
            const isOver = isLifetimeOver(option.hours);
            return (
              <Pressable
                key={option.hours}
                onPress={() => set({ lifetimeHours: option.hours })}
                disabled={isOver}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: isOver }}
                style={({ pressed }) => [
                  styles.lifetime,
                  {
                    backgroundColor: isSelected ? theme.tint : theme.surface,
                    borderColor: isSelected ? theme.tint : theme.border,
                    opacity: isOver ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}>
                <Text style={[styles.lifetimeText, { color: isSelected ? theme.onTint : theme.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ThemedText variant="caption" color="textSecondary">
          {postedAt
            ? 'Counted from when you first posted it. After that it’s gone for everyone.'
            : 'After this your Blink is gone for everyone. The longest is 3 days.'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg },
  section: { gap: Spacing.sm },
  composer: { padding: Spacing.lg, gap: Spacing.md },
  composerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    minHeight: 72,
    fontFamily: Fonts.regular,
    fontSize: 19,
    lineHeight: 27,
    textAlignVertical: 'top',
  },
  selected: { alignSelf: 'flex-start', paddingTop: 4, paddingRight: 6 },
  remove: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  counterText: { fontFamily: Fonts.semibold, fontSize: 13 },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  photoButtonText: { fontFamily: Fonts.bold, fontSize: 13 },
  removePhoto: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // Compact tiles, four to a row, so the whole picker and the lifetime choices fit on
  // most phones; the screen scrolls for the rest.
  moodOption: {
    flexBasis: '22%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: Radius.md,
  },
  moodEmoji: { fontSize: 22, lineHeight: 27 },
  moodLabel: { fontSize: 11 },
  lifetimes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  lifetime: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifetimeText: { fontFamily: Fonts.bold, fontSize: 14 },
});
