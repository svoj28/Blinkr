import { StyleSheet, Text, View } from 'react-native';

import { getMood, type MoodId } from '@/constants/moods';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MoodBadgeProps = {
  id: MoodId;
  /** Larger text on the Blink details screen and in the composer. */
  large?: boolean;
};

/** "😊 Feeling happy", a soft pill shown on a Blink. */
export function MoodBadge({ id, large = false }: MoodBadgeProps) {
  const theme = useTheme();
  const mood = getMood(id);

  return (
    <View
      accessible
      accessibilityLabel={`Feeling ${mood.label.toLowerCase()}`}
      style={[styles.pill, large && styles.pillLarge, { backgroundColor: theme.tintSoft }]}>
      <Text style={large ? styles.emojiLarge : styles.emoji}>{mood.emoji}</Text>
      <Text style={[styles.text, large && styles.textLarge, { color: theme.text }]}>
        Feeling <Text style={{ fontFamily: Fonts.bold }}>{mood.label.toLowerCase()}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: Radius.pill,
  },
  pillLarge: { paddingVertical: 8, paddingLeft: 10, paddingRight: 16, gap: 8 },
  emoji: { fontSize: 18, lineHeight: 22 },
  emojiLarge: { fontSize: 26, lineHeight: 32 },
  text: { fontFamily: Fonts.medium, fontSize: 14 },
  textLarge: { fontSize: 16 },
});
