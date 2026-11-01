import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import type { ProfileSummary } from '@/types';

type ActiveStripProps = {
  people: ProfileSummary[];
  /** Ids of people active right now. */
  online: ReadonlySet<string>;
  onPress: (person: ProfileSummary) => void;
};

/**
 * A sideways row of avatars: people active right now first (with a green dot),
 * then everyone who isn't, further to the right and slightly faded.
 */
export function ActiveStrip({ people, online, onPress }: ActiveStripProps) {
  const theme = useTheme();
  const { gutter } = useLayout();
  if (people.length === 0) return null;

  const byName = (a: ProfileSummary, b: ProfileSummary) => a.displayName.localeCompare(b.displayName);
  const active = people.filter((p) => online.has(p.id)).sort(byName);
  const inactive = people.filter((p) => !online.has(p.id)).sort(byName);

  return (
    <View style={styles.wrap}>
      <ThemedText variant="label" color={active.length > 0 ? 'text' : 'textSecondary'} style={{ paddingHorizontal: gutter }}>
        {active.length > 0 ? `Active now · ${active.length}` : 'No one active right now'}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}>
        {[...active, ...inactive].map((person) => {
          const isActive = online.has(person.id);
          const firstName = person.displayName.split(' ')[0];
          return (
            <Pressable
              key={person.id}
              onPress={() => onPress(person)}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${person.displayName}, ${isActive ? 'active now' : 'not active'}`}
              style={({ pressed }) => [styles.person, { opacity: pressed ? 0.7 : isActive ? 1 : 0.55 }]}>
              <View>
                <Avatar user={person} size={54} />
                {isActive && (
                  <View style={[styles.dot, { backgroundColor: theme.online, borderColor: theme.background }]} />
                )}
              </View>
              <ThemedText variant="caption" color={isActive ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.name}>
                {firstName}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  row: { gap: Spacing.md },
  person: { width: 64, alignItems: 'center', gap: 4 },
  dot: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  name: { maxWidth: 64, textAlign: 'center' },
});
