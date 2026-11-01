import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  clamp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useClosedBlinkers } from '@/api/closed-blinkers';
import { useConversations } from '@/api/messages';
import { useUnreadNotificationCount } from '@/api/notifications';
import { useProfile } from '@/api/profiles';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';
import { saveAccount, useSavedAccounts } from '@/state/saved-accounts';
import { formatCount } from '@/utils/format';

type IconName = ComponentProps<typeof Ionicons>['name'];

type DrawerContextValue = { open: () => void; close: () => void };

const DrawerContext = createContext<DrawerContextValue | null>(null);

/** Null outside the signed-in app (e.g. on sign-in), where there is no drawer. */
export function useDrawer(): DrawerContextValue | null {
  return useContext(DrawerContext);
}

const OPEN_MS = 260;

/**
 * Blinkr's side menu: your profile, friends, settings and accounts, one tap from any tab.
 * Slides in over the tabs (dock included); tap outside, swipe left or press Back to close.
 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(340, Math.round(width * 0.86));
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : OPEN_MS;

  const progress = useSharedValue(0);
  const [isMounted, setIsMounted] = useState(false);

  const open = useCallback(() => {
    setIsMounted(true);
    progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [duration, progress]);

  const close = useCallback(() => {
    progress.value = withTiming(0, { duration, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(setIsMounted, false);
    });
  }, [duration, progress]);

  // Android back button closes the menu first.
  useEffect(() => {
    if (!isMounted) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [isMounted, close]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      progress.value = clamp(1 + Math.min(event.translationX, 0) / panelWidth, 0, 1);
    })
    .onEnd((event) => {
      if (event.velocityX < -500 || progress.value < 0.6) {
        progress.value = withTiming(0, { duration }, (finished) => {
          if (finished) scheduleOnRN(setIsMounted, false);
        });
      } else {
        progress.value = withTiming(1, { duration });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * panelWidth }] }));

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <DrawerContext.Provider value={value}>
      <View style={styles.fill}>
        {/* Hide the screen behind from screen readers while the menu is open. */}
        <View
          style={styles.fill}
          importantForAccessibility={isMounted ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={isMounted}>
          {children}
        </View>

        {isMounted && (
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
              <Pressable style={styles.fill} onPress={close} accessibilityRole="button" accessibilityLabel="Close menu" />
            </Animated.View>
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.panelWrap, { width: panelWidth }, panelStyle]}>
                <DrawerPanel onClose={close} />
              </Animated.View>
            </GestureDetector>
          </View>
        )}
      </View>
    </DrawerContext.Provider>
  );
}

/** Your avatar in the header; opens the menu. Falls back to a menu icon while the profile loads. */
export function DrawerButton() {
  const theme = useTheme();
  const drawer = useDrawer();
  const { userId } = useAuth();
  const { data: profile } = useProfile(userId);
  if (!drawer) return null;

  return (
    <Pressable
      onPress={drawer.open}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      style={({ pressed }) => [styles.menuButton, { opacity: pressed ? 0.7 : 1 }]}>
      {profile ? (
        <Avatar user={profile} size={42} />
      ) : (
        <View style={[styles.menuFallback, { borderColor: theme.border }]}>
          <Ionicons name="menu" size={22} color={theme.text} />
        </View>
      )}
      <View style={[styles.menuGlyph, { backgroundColor: theme.surface, borderColor: theme.background }]}>
        <Ionicons name="menu" size={11} color={theme.text} />
      </View>
    </Pressable>
  );
}

function DrawerPanel({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, signOut, switchAccount } = useAuth();
  const { data: profile } = useProfile(userId);
  const { data: unreadNotifications = 0 } = useUnreadNotificationCount();
  const { data: conversations } = useConversations();
  const unreadMessages = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
  const { data: closedBlinkers } = useClosedBlinkers(userId);
  const savedAccounts = useSavedAccounts();
  const [showAccounts, setShowAccounts] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  // Keep the saved account's name and color in step with the profile, for the switcher.
  useEffect(() => {
    if (profile) {
      saveAccount(profile.id, {
        username: profile.username,
        displayName: profile.displayName,
        avatarColor: profile.avatarColor,
        avatar: profile.avatar,
      });
    }
  }, [profile]);

  const go = (href: Href, replaceTab = false) => {
    onClose();
    if (replaceTab) router.navigate(href);
    else router.push(href);
  };

  const invite = () => {
    const handle = profile ? ` I’m @${profile.username}.` : '';
    Share.share({ message: `Come join me on Blinkr, short thoughts set in print.${handle}` }).catch(() => {});
  };

  const changeAccount = async (targetId: string) => {
    if (targetId === userId || switchingTo) return;
    setSwitchingTo(targetId);
    try {
      await switchAccount(targetId);
      onClose();
      router.navigate('/');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Couldn’t switch account', message);
    } finally {
      setSwitchingTo(null);
    }
  };

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const hasOtherAccounts = savedAccounts.some((a) => a.userId !== userId);

  const version = Constants.expoConfig?.version;

  return (
    <View
      accessibilityViewIsModal
      style={[
        styles.panel,
        {
          backgroundColor: theme.background,
          borderRightColor: theme.border,
          paddingTop: insets.top + Spacing.sm,
          paddingBottom: insets.bottom + Spacing.md,
        },
      ]}>
      <View style={styles.panelHeader}>
        <Text style={[styles.wordmark, { color: theme.text }]} accessibilityRole="header">
          Blinkr<Text style={{ color: theme.tint }}>.</Text>
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          hitSlop={8}
          style={({ pressed }) => [styles.closeButton, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* You */}
        <Pressable
          onPress={() => go('/profile')}
          accessibilityRole="link"
          accessibilityLabel="Your profile">
          {({ pressed }) => (
            <Card style={styles.profileCard} pressed={pressed}>
              {profile ? (
                <>
                  <Avatar user={profile} size={52} />
                  <View style={styles.profileText}>
                    <ThemedText variant="heading" numberOfLines={1}>
                      {profile.displayName}
                    </ThemedText>
                    <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                      @{profile.username}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </>
              ) : (
                <ActivityIndicator color={theme.tint} style={styles.profileLoading} />
              )}
            </Card>
          )}
        </Pressable>

        {profile && (
          <Pressable
            onPress={() => go('/friends')}
            accessibilityRole="link"
            accessibilityLabel={`${profile.followingCount} following, ${profile.followerCount} followers`}
            style={({ pressed }) => [styles.stats, { opacity: pressed ? 0.7 : 1 }]}>
            <Stat value={profile.followingCount} label="Following" />
            <View style={[styles.statDot, { backgroundColor: theme.border }]} />
            <Stat value={profile.followerCount} label={profile.followerCount === 1 ? 'Follower' : 'Followers'} />
          </Pressable>
        )}

        <Section label="Browse">
          {/* Your profile itself opens from the card at the top. */}
          <DrawerItem icon="create-outline" label="Edit profile" onPress={() => go('/edit-profile')} />
          <DrawerItem icon="people-outline" label="Friends" onPress={() => go('/friends')} />
          {/* Its own circle, kept apart from following/followers. Badge = requests to answer. */}
          <DrawerItem
            icon="lock-closed-outline"
            label="Closed Blinkers"
            badge={closedBlinkers?.incoming.length ?? 0}
            onPress={() => go('/closed-blinkers')}
          />
          <DrawerItem
            icon="notifications-outline"
            label="Notifications"
            badge={unreadNotifications}
            onPress={() => go('/notifications', true)}
          />
          <DrawerItem icon="mail-outline" label="Messages" badge={unreadMessages} onPress={() => go('/messages', true)} />
          <DrawerItem icon="search-outline" label="Find people" onPress={() => go('/search', true)} />
          <DrawerItem icon="share-social-outline" label="Invite friends" onPress={invite} />
        </Section>

        <Section label="Account">
          <DrawerItem icon="settings-outline" label="Settings" onPress={() => go('/settings')} />
          <DrawerItem
            icon="swap-horizontal-outline"
            label="Switch account"
            onPress={() => setShowAccounts((shown) => !shown)}
            expanded={showAccounts}
          />
          {showAccounts && (
            <Card style={styles.accounts}>
              {savedAccounts.map((account) => {
                const isCurrent = account.userId === userId;
                return (
                  <Pressable
                    key={account.userId}
                    onPress={() => changeAccount(account.userId)}
                    disabled={isCurrent || !!switchingTo}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isCurrent, busy: switchingTo === account.userId }}
                    accessibilityLabel={
                      isCurrent ? `${account.displayName}, current account` : `Switch to ${account.displayName}`
                    }
                    style={({ pressed }) => [styles.accountRow, { opacity: pressed ? 0.7 : 1 }]}>
                    <Avatar
                      user={{ displayName: account.displayName || account.email, avatarColor: account.avatarColor, avatar: account.avatar }}
                      size={34}
                    />
                    <View style={styles.profileText}>
                      <ThemedText variant="captionStrong" numberOfLines={1}>
                        {account.displayName || account.email}
                      </ThemedText>
                      <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                        {account.username ? `@${account.username}` : account.email}
                      </ThemedText>
                    </View>
                    {switchingTo === account.userId ? (
                      <ActivityIndicator size="small" color={theme.tint} />
                    ) : isCurrent ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.tint} />
                    ) : null}
                  </Pressable>
                );
              })}
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Pressable
                onPress={() => go('/add-account')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.accountRow, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.addIcon, { backgroundColor: theme.tintSoft }]}>
                  <Ionicons name="add" size={20} color={theme.tint} />
                </View>
                <ThemedText variant="captionStrong" color="tint">
                  Add an account
                </ThemedText>
              </Pressable>
            </Card>
          )}
          <DrawerItem icon="log-out-outline" label="Log out" tone="danger" onPress={() => setConfirmingSignOut(true)} />
        </Section>

        <ThemedText variant="caption" color="textSecondary" style={styles.footer}>
          Blinkr{version ? ` · Version ${version}` : ''}
        </ThemedText>
      </ScrollView>

      <ConfirmDialog
        visible={confirmingSignOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          setConfirmingSignOut(false);
          onClose();
          signOut();
        }}
        title={`Log out of ${profile ? `@${profile.username}` : 'this account'}?`}
        message={
          hasOtherAccounts
            ? 'Your other accounts stay signed in on this device.'
            : 'You can sign back in any time with your email and password.'
        }
        confirmLabel="Log out"
        tone="danger"
        icon="log-out-outline"
        leading={profile ? <Avatar user={profile} size={56} /> : undefined}
      />
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <ThemedText variant="caption" color="textSecondary">
      <ThemedText variant="captionStrong">{formatCount(value)}</ThemedText> {label}
    </ThemedText>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="label" color="textSecondary" style={styles.sectionLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

type DrawerItemProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
  tone?: 'danger';
  /** Set for items that expand in place (shows a chevron that turns). */
  expanded?: boolean;
};

function DrawerItem({ icon, label, onPress, badge = 0, tone, expanded }: DrawerItemProps) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : theme.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} new` : label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.tintSoft }]}>
      <Ionicons name={icon} size={21} color={color} />
      <Text style={[styles.itemLabel, { color }]}>{label}</Text>
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.like }]}>
          <Text style={styles.badgeText}>{Math.min(badge, 99)}</Text>
        </View>
      )}
      {expanded !== undefined && (
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(8, 10, 12, 0.5)' },
  panelWrap: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  panel: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    boxShadow: '8px 0 28px rgba(0, 0, 0, 0.25)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  wordmark: { fontFamily: Fonts.serifBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, minHeight: 78 },
  profileLoading: { flex: 1 },
  profileText: { flex: 1, minWidth: 0 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.md,
  },
  statDot: { width: 4, height: 4, borderRadius: 2 },
  section: { paddingTop: Spacing.xl, gap: 2 },
  sectionLabel: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  itemLabel: { flex: 1, fontFamily: Fonts.semibold, fontSize: 16 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 11, lineHeight: 13 },
  accounts: { marginVertical: Spacing.xs, marginLeft: Spacing.xxl, paddingVertical: Spacing.xs },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  addIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: Spacing.md, marginVertical: Spacing.xs },
  footer: { paddingTop: Spacing.xl, paddingHorizontal: Spacing.sm },
  menuButton: { width: 44, height: 44, justifyContent: 'center' },
  menuFallback: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuGlyph: {
    position: 'absolute',
    right: -3,
    bottom: -2,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
