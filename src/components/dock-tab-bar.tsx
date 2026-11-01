import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { type ComponentProps, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Card } from '@/components/card';
import { PressableScale, snappy } from '@/components/motion';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const DockIcons: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'newspaper', inactive: 'newspaper-outline' },
  search: { active: 'search', inactive: 'search-outline' },
  create: { active: 'add', inactive: 'add' },
  messages: { active: 'mail', inactive: 'mail-outline' },
  notifications: { active: 'notifications', inactive: 'notifications-outline' },
};

const PILL_WIDTH = 48;
const PILL_HEIGHT = 30;

type ItemLayout = { x: number; y: number; width: number };

/**
 * Blinkr's navigation: a floating dock instead of a flat, edge-to-edge tab bar.
 * Every tab keeps an icon *and* a label, the active tab is marked by a soft pill that
 * slides between tabs, and "Create" sits in the middle as a round button.
 */
export function DockTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const [layouts, setLayouts] = useState<Record<number, ItemLayout>>({});

  const focusedRoute = state.routes[state.index];
  const target = layouts[state.index];
  const showPill = !!target && focusedRoute?.name !== 'create';

  // The pill glides to the focused tab (and jumps there the first time, before anything is visible).
  const pillX = useSharedValue(0);
  const pillY = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const pillStretch = useSharedValue(1);
  useEffect(() => {
    if (!target) return;
    const x = target.x + (target.width - PILL_WIDTH) / 2;
    if (pillOpacity.value === 0) {
      pillX.value = x;
      pillY.value = target.y;
    } else {
      pillX.value = withSpring(x, snappy);
      pillY.value = withSpring(target.y, snappy);
      // A little stretch while it travels, like ink being dragged.
      pillStretch.value = withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, snappy));
    }
    pillOpacity.value = withTiming(showPill ? 1 : 0, { duration: 160 });
  }, [target, showPill, pillX, pillY, pillOpacity, pillStretch]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ translateX: pillX.value }, { translateY: pillY.value }, { scaleX: pillStretch.value }],
  }));

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.column}>
        <Card elevated radius={24} style={styles.dock}>
          <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: theme.tintSoft }, pillStyle]} />

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const isFocused = state.index === index;
            const icons = DockIcons[route.name] ?? DockIcons.index;
            const isCreate = route.name === 'create';

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <PressableScale
                key={route.key}
                onPress={onPress}
                scaleTo={0.88}
                onLayout={({ nativeEvent: { layout } }) =>
                  setLayouts((current) => {
                    const known = current[index];
                    if (known && known.x === layout.x && known.y === layout.y && known.width === layout.width) {
                      return current;
                    }
                    return { ...current, [index]: { x: layout.x, y: layout.y, width: layout.width } };
                  })
                }
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={
                  (options.tabBarAccessibilityLabel ?? label) +
                  (options.tabBarBadge !== undefined ? `, ${options.tabBarBadge} unread` : '')
                }
                style={styles.item}>
                {isCreate ? (
                  <CreateButton isFocused={isFocused} />
                ) : (
                  <View style={styles.iconWrap}>
                    <TabIcon
                      name={isFocused ? icons.active : icons.inactive}
                      isFocused={isFocused}
                      color={isFocused ? theme.tint : theme.textSecondary}
                    />
                    {options.tabBarBadge !== undefined && (
                      // Keyed by the count, so each new unread pops in.
                      <Animated.View
                        key={String(options.tabBarBadge)}
                        entering={ZoomIn.springify().damping(12)}
                        style={[styles.badge, { backgroundColor: theme.like, borderColor: theme.surface }]}>
                        <Text style={styles.badgeText}>{options.tabBarBadge}</Text>
                      </Animated.View>
                    )}
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color: isFocused || isCreate ? theme.text : theme.textSecondary,
                      fontFamily: isFocused ? Fonts.bold : Fonts.medium,
                    },
                  ]}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </Card>
      </View>
    </View>
  );
}

/** A tab icon that gives a small hop when its tab becomes active. */
function TabIcon({ name, isFocused, color }: { name: IconName; isFocused: boolean; color: string }) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (isFocused) {
      scale.value = withSequence(withSpring(1.2, snappy), withSpring(1, snappy));
      lift.value = withSequence(withSpring(-3, snappy), withSpring(0, snappy));
    }
  }, [isFocused, scale, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={21} color={color} />
    </Animated.View>
  );
}

/** The round "+" in the middle. It turns a quarter each time Create opens. */
function CreateButton({ isFocused }: { isFocused: boolean }) {
  const theme = useTheme();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (isFocused) turn.value = withSpring(turn.value + 90, snappy);
  }, [isFocused, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <View style={[styles.create, { backgroundColor: theme.tint }]}>
      <Animated.View style={style}>
        <Ionicons name="add" size={26} color={theme.onTint} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingTop: 6 },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  dock: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  pill: { position: 'absolute', top: 0, left: 0, width: PILL_WIDTH, height: PILL_HEIGHT, borderRadius: Radius.pill },
  item: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  iconWrap: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
  label: { fontSize: 11, lineHeight: 14 },
  badge: {
    position: 'absolute',
    top: -4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 10, lineHeight: 12 },
});
