/**
 * The moods a Blink can carry ("Select a Mood" when posting). At most one per Blink.
 * Keep the ids in step with the blinks_mood_check constraint in supabase/blinkr-schema.sql.
 */
export const Moods = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'excited', emoji: '🤩', label: 'Excited' },
  { id: 'loved', emoji: '🥰', label: 'Loved' },
  { id: 'grateful', emoji: '🙏', label: 'Grateful' },
  { id: 'chill', emoji: '😌', label: 'Chill' },
  { id: 'cool', emoji: '😎', label: 'Cool' },
  { id: 'laughing', emoji: '😂', label: 'Laughing' },
  { id: 'celebrating', emoji: '🥳', label: 'Celebrating' },
  { id: 'motivated', emoji: '💪', label: 'Motivated' },
  { id: 'thoughtful', emoji: '🤔', label: 'Thoughtful' },
  { id: 'hungry', emoji: '🤤', label: 'Hungry' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'stressed', emoji: '😩', label: 'Stressed' },
  { id: 'frustrated', emoji: '😤', label: 'Frustrated' },
  { id: 'unwell', emoji: '🤒', label: 'Unwell' },
] as const;

export type MoodId = (typeof Moods)[number]['id'];
export type MoodInfo = (typeof Moods)[number];

export function getMood(id: MoodId): MoodInfo {
  return Moods.find((mood) => mood.id === id) ?? Moods[0];
}

/**
 * How long a Blink stays up before it disappears for everyone. The database allows
 * 1 to 72 hours, so 3 days is the most.
 */
export const BlinkLifetimes = [
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
] as const;

export const DefaultLifetimeHours = 24;
