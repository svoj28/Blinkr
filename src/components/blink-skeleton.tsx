import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';

/** Pulsing card-shaped placeholders shown while Blinks are loading. */
export function BlinkSkeletonList({ count = 3 }: { count?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }} accessibilityLabel="Loading Blinks" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </Animated.View>
  );
}

function SkeletonCard() {
  const theme = useTheme();
  const { gutter, avatarSize } = useLayout();
  const block = { backgroundColor: theme.skeleton };

  return (
    <View style={{ marginHorizontal: gutter, marginBottom: Spacing.md }}>
      <Card accentColor={theme.skeleton} style={styles.card}>
        <View style={styles.header}>
          <View style={[block, { width: avatarSize, height: avatarSize, borderRadius: avatarSize * 0.3 }]} />
          <View style={styles.lines}>
            <View style={[styles.line, block, { width: '50%' }]} />
            <View style={[styles.line, block, { width: '30%' }]} />
          </View>
        </View>
        <View style={[styles.line, block, { width: '95%' }]} />
        <View style={[styles.line, block, { width: '75%' }]} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  lines: { flex: 1, gap: 8 },
  line: { height: 12, borderRadius: Radius.sm },
});
