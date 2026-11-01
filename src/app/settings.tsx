import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/api/profiles';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  setAppearancePreference,
  useAppearancePreference,
  type AppearancePreference,
} from '@/hooks/use-color-scheme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { session, userId, signOut } = useAuth();
  const { data: profile } = useProfile(userId);
  const appearance = useAppearancePreference();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}>
        <Group label="Account">
          <Card style={styles.card}>
            {profile && (
              <Pressable
                onPress={() => router.push('/profile')}
                accessibilityRole="link"
                style={({ pressed }) => [styles.accountRow, { opacity: pressed ? 0.7 : 1 }]}>
                <Avatar user={profile} size={44} />
                <View style={styles.flex}>
                  <ThemedText variant="bodyStrong" numberOfLines={1}>
                    {profile.displayName}
                  </ThemedText>
                  <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                    {session?.user.email ?? `@${profile.username}`}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
            <Divider />
            <Row icon="people-outline" label="Friends" onPress={() => router.push('/friends')} />
            <Divider />
            <Row icon="person-add-outline" label="Add another account" onPress={() => router.push('/add-account')} />
          </Card>
        </Group>

        <Group label="Appearance">
          <Card style={[styles.card, styles.segmented]}>
            {APPEARANCE_OPTIONS.map((option) => {
              const isActive = appearance === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setAppearancePreference(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  style={[styles.segment, isActive && { backgroundColor: theme.tintSoft }]}>
                  <Ionicons name={option.icon} size={20} color={isActive ? theme.tint : theme.textSecondary} />
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: isActive ? theme.text : theme.textSecondary, fontFamily: isActive ? Fonts.bold : Fonts.medium },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </Group>

        {Platform.OS !== 'web' && (
          <Group label="Notifications">
            <Card style={styles.card}>
              <Row
                icon="notifications-outline"
                label="Push notifications"
                detail="Manage in your phone’s settings"
                onPress={() => Linking.openSettings()}
                external
              />
            </Card>
          </Group>
        )}

        <Group label="About">
          <Card style={styles.card}>
            <Row icon="information-circle-outline" label="Version" value={version} />
          </Card>
        </Group>

        <Card style={styles.card}>
          <Row icon="log-out-outline" label="Log out" tone="danger" onPress={() => setConfirmingSignOut(true)} />
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirmingSignOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          setConfirmingSignOut(false);
          signOut();
        }}
        title={`Log out of ${profile ? `@${profile.username}` : 'Blinkr'}?`}
        message="You can sign back in any time with your email and password."
        confirmLabel="Log out"
        tone="danger"
        icon="log-out-outline"
        leading={profile ? <Avatar user={profile} size={56} /> : undefined}
      />
    </Screen>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText variant="label" color="textSecondary" style={styles.groupLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

type RowProps = {
  icon: IconName;
  label: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  tone?: 'danger';
  /** Opens outside the app (shows an arrow instead of a chevron). */
  external?: boolean;
};

function Row({ icon, label, detail, value, onPress, tone, external }: RowProps) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={21} color={color} />
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {detail && (
          <ThemedText variant="caption" color="textSecondary">
            {detail}
          </ThemedText>
        )}
      </View>
      {value && (
        <ThemedText variant="caption" color="textSecondary">
          {value}
        </ThemedText>
      )}
      {onPress && tone !== 'danger' && (
        <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={17} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  group: { gap: Spacing.sm },
  groupLabel: { paddingHorizontal: Spacing.xs },
  card: { overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52, paddingHorizontal: Spacing.md },
  rowLabel: { fontFamily: Fonts.semibold, fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: Spacing.md },
  segmented: { flexDirection: 'row', padding: Spacing.xs, gap: Spacing.xs },
  segment: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  segmentLabel: { fontSize: 13 },
});
