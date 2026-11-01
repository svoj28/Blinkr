import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DrawerButton, useDrawer } from '@/components/app-drawer';
import { PressableScale } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';

type AppHeaderProps = {
  /** Screen title. Leave empty on the feed to show the Blinkr wordmark instead. */
  title?: string;
  /** Small line under the title (a dateline on the feed). */
  subtitle?: string;
  right?: ReactNode;
};

/**
 * Top of every tab: your avatar (opens the menu) on the left, then the Blinkr wordmark
 * or the screen title, and actions on the right. On sign-in, where there's no menu,
 * the wordmark is shown large instead.
 */
export function AppHeader({ title, subtitle, right }: AppHeaderProps) {
  const theme = useTheme();
  const { gutter } = useLayout();
  const hasMenu = !!useDrawer();
  const isMasthead = !title;
  const isLargeMasthead = isMasthead && !hasMenu;

  return (
    <View style={[styles.column, { paddingHorizontal: gutter }]}>
      <View style={styles.row}>
        {hasMenu && <DrawerButton />}
        <View style={styles.titleBlock}>
          {isMasthead ? (
            <Text
              accessibilityRole="header"
              style={[isLargeMasthead ? styles.wordmarkLarge : styles.wordmark, { color: theme.text }]}>
              Blinkr<Text style={{ color: theme.tint }}>.</Text>
            </Text>
          ) : (
            <ThemedText variant="title" accessibilityRole="header" numberOfLines={1} style={styles.title}>
              {title}
            </ThemedText>
          )}
          {subtitle && (
            <ThemedText
              variant={isLargeMasthead ? 'italic' : isMasthead ? 'label' : 'caption'}
              color="textSecondary"
              numberOfLines={1}>
              {subtitle}
            </ThemedText>
          )}
        </View>
        {right && <View style={styles.actions}>{right}</View>}
      </View>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
    </View>
  );
}

type HeaderIconButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  /** Unread count shown on the button. */
  badge?: number;
};

/** Round outlined button for header actions (notifications, settings…). */
export function HeaderIconButton({ icon, label, onPress, badge = 0 }: HeaderIconButtonProps) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} new` : label}
      hitSlop={8}
      style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Ionicons name={icon} size={21} color={theme.text} />
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.like, borderColor: theme.background }]}>
          <Text style={styles.badgeText}>{Math.min(badge, 99)}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingTop: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, minHeight: 56 },
  titleBlock: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: Fonts.serifBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  wordmarkLarge: { fontFamily: Fonts.serifBold, fontSize: 40, lineHeight: 44, letterSpacing: -0.6 },
  title: { fontSize: 28, lineHeight: 34 },
  rule: { height: StyleSheet.hairlineWidth * 2 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 10, lineHeight: 12 },
});
