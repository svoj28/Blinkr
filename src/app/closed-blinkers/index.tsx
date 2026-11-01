import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { useStartCall } from '@/api/calls';
import {
  useClosedBlinkers,
  useRemoveClosedBlinker,
  useRespondClosedBlinker,
} from '@/api/closed-blinkers';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EnterItem } from '@/components/motion';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';
import type { ClosedBlinker } from '@/types';
import { formatRelativeTime } from '@/utils/format';

type Section = { key: 'incoming' | 'outgoing' | 'accepted'; title: string; data: ClosedBlinker[] };

/**
 * Your private circle, kept apart from following/followers.
 * Requests to accept or reject, requests you sent, and the people already in it.
 */
export default function ClosedBlinkersScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const lists = useClosedBlinkers(userId);

  if (lists.isPending) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState message="Loading your Closed Blinkers…" />
      </Screen>
    );
  }

  if (lists.isError && !lists.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="We couldn’t load your Closed Blinkers." onRetry={() => lists.refetch()} />
      </Screen>
    );
  }

  const { incoming, outgoing, accepted } = lists.data;
  const sections: Section[] = [
    { key: 'incoming' as const, title: `Requests · ${incoming.length}`, data: incoming },
    { key: 'outgoing' as const, title: 'Sent', data: outgoing },
    { key: 'accepted' as const, title: `Your Closed Blinkers · ${accepted.length}`, data: accepted },
  ].filter((section) => section.data.length > 0);

  return (
    <Screen edges={['bottom']}>
      <View style={contentColumn}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.user.id}
          renderItem={({ item, index }) => (
            <EnterItem index={index}>
              <ClosedBlinkerRow item={item} />
            </EnterItem>
          )}
          renderSectionHeader={({ section }) => (
            <ThemedText
              variant="label"
              color={section.key === 'incoming' ? 'tint' : 'textSecondary'}
              style={[styles.sectionTitle, { paddingHorizontal: gutter, backgroundColor: theme.background }]}>
              {section.title}
            </ThemedText>
          )}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: gutter, paddingTop: Spacing.lg }}>
              <Card style={styles.intro}>
                <View style={[styles.introIcon, { backgroundColor: theme.tintSoft }]}>
                  <Ionicons name="lock-closed" size={20} color={theme.tint} />
                </View>
                <View style={styles.flex}>
                  <ThemedText variant="bodyStrong">Your private circle</ThemedText>
                  <ThemedText variant="caption" color="textSecondary">
                    Separate from who you follow. People join only with your QR code or UID, and you both have to
                    agree.
                  </ThemedText>
                </View>
              </Card>
              <View style={styles.addButton}>
                <Button
                  title="Add a Closed Blinker"
                  icon="qr-code-outline"
                  onPress={() => router.push('/closed-blinkers/add')}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="lock-closed-outline"
              title="No Closed Blinkers yet"
              message="Show someone your QR code, or scan theirs, to invite them into your circle."
            />
          }
          refreshControl={
            <RefreshControl refreshing={lists.isRefetching} onRefresh={() => lists.refetch()} tintColor={theme.tint} />
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Spacing.xl }}
        />
      </View>
    </Screen>
  );
}

function ClosedBlinkerRow({ item }: { item: ClosedBlinker }) {
  const { gutter, avatarSize } = useLayout();
  const respond = useRespondClosedBlinker();
  const remove = useRemoveClosedBlinker();
  const { start: startCall, startingKind } = useStartCall();
  const { user } = item;

  const confirmRemove = () => {
    const title = `Remove ${user.displayName} from your Closed Blinkers?`;
    const run = () => remove.mutate(user.id);
    // Alert buttons don't work in the browser.
    if (Platform.OS === 'web') {
      if (window.confirm(title)) run();
      return;
    }
    Alert.alert(title, 'They won’t be told. You’d need their QR code or UID to add them again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: run },
    ]);
  };

  const detail =
    item.status === 'accepted'
      ? `@${user.username}`
      : item.direction === 'incoming'
        ? `Wants to add you · ${formatRelativeTime(item.createdAt)}`
        : `Request sent · ${formatRelativeTime(item.createdAt)}`;

  return (
    <Pressable
      onPress={() => router.push(`/user/${user.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${user.displayName}'s profile`}
      style={({ pressed }) => [styles.row, { paddingHorizontal: gutter, opacity: pressed ? 0.7 : 1 }]}>
      <Avatar user={user} size={avatarSize} />
      <View style={styles.flex}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {user.displayName}
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>

      {item.status === 'pending' && item.direction === 'incoming' && (
        <View style={styles.actions}>
          <Pill
            label="Reject"
            accessibilityLabel={`Reject ${user.displayName}'s request`}
            onPress={() => respond.mutate({ requester: user, accept: false })}
          />
          <Pill
            label="Accept"
            primary
            accessibilityLabel={`Accept ${user.displayName}'s request`}
            onPress={() => respond.mutate({ requester: user, accept: true })}
          />
        </View>
      )}
      {item.status === 'pending' && item.direction === 'outgoing' && (
        <Pill
          label="Cancel"
          accessibilityLabel={`Cancel your request to ${user.displayName}`}
          onPress={() => remove.mutate(user.id)}
        />
      )}
      {item.status === 'accepted' && (
        <View style={styles.actions}>
          {/* Calls are a Closed Blinkers-only feature. */}
          <Pill
            icon="call-outline"
            accessibilityLabel={`Voice call ${user.displayName}`}
            onPress={() => startCall(user, 'audio')}
            disabled={!!startingKind}
          />
          <Pill
            icon="videocam-outline"
            accessibilityLabel={`Video call ${user.displayName}`}
            onPress={() => startCall(user, 'video')}
            disabled={!!startingKind}
          />
          <Pill icon="ellipsis-horizontal" accessibilityLabel={`Remove ${user.displayName}`} onPress={confirmRemove} />
        </View>
      )}
    </Pressable>
  );
}

type PillProps = {
  label?: string;
  icon?: 'ellipsis-horizontal' | 'call-outline' | 'videocam-outline';
  primary?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};

function Pill({ label, icon, primary = false, accessibilityLabel, onPress, disabled = false }: PillProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        icon && styles.iconPill,
        {
          borderColor: primary ? theme.tint : theme.border,
          backgroundColor: primary ? theme.tint : 'transparent',
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {icon ? (
        <Ionicons name={icon} size={18} color={theme.text} />
      ) : (
        <Text style={[styles.pillText, { color: primary ? theme.onTint : theme.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  intro: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, alignItems: 'flex-start' },
  introIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addButton: { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  sectionTitle: { paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  pill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPill: { width: 36, paddingHorizontal: 0 },
  pillText: { fontFamily: Fonts.bold, fontSize: 14 },
});
