import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useTone } from '@/hooks/use-tone';
import type { ProfileDetails } from '@/types';
import { formatCount } from '@/utils/format';

type ProfileHeaderProps = {
  profile: ProfileDetails;
  /** Buttons under the card (Follow / Message on other people's profiles). */
  actions?: ReactNode;
};

/** The profile card used on your own profile and on everyone else's. */
export function ProfileHeader({ profile, actions }: ProfileHeaderProps) {
  const theme = useTheme();
  const tone = useTone(profile.id);
  const { isCompact } = useLayout();
  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <Card accentColor={tone} style={styles.card}>
      <View style={styles.identity}>
        <Avatar user={profile} size={isCompact ? 64 : 76} />
        <View style={styles.names}>
          <ThemedText variant="title" numberOfLines={2}>
            {profile.displayName}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            @{profile.username}
          </ThemedText>
        </View>
      </View>

      {profile.bio.length > 0 && <ThemedText>{profile.bio}</ThemedText>}

      <View style={styles.metaRow}>
        {profile.location.length > 0 && (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={15} color={theme.textSecondary} />
            <ThemedText variant="caption" color="textSecondary">
              {profile.location}
            </ThemedText>
          </View>
        )}
        <View style={styles.meta}>
          <Ionicons name="calendar-outline" size={15} color={theme.textSecondary} />
          <ThemedText variant="caption" color="textSecondary">
            Joined {joined}
          </ThemedText>
        </View>
      </View>

      {/* Stats, separated by fine vertical rules */}
      <View style={[styles.stats, { borderTopColor: theme.border }]}>
        <Stat value={profile.blinkCount} label={profile.blinkCount === 1 ? 'Blink' : 'Blinks'} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Stat value={profile.followerCount} label={profile.followerCount === 1 ? 'Follower' : 'Followers'} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Stat value={profile.followingCount} label="Following" />
      </View>

      {actions && <View style={styles.actions}>{actions}</View>}
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText variant="heading">{formatCount(value)}</ThemedText>
      <ThemedText variant="caption" color="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  names: { flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: Spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  divider: { width: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
