import { useWindowDimensions } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Responsive values derived from the screen width.
 * Small phones (e.g. iPhone SE, 320-360pt wide) get tighter padding and smaller avatars.
 */
export function useLayout() {
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const contentWidth = Math.min(width, MaxContentWidth);

  return {
    isCompact,
    contentWidth,
    gutter: isCompact ? Spacing.md : Spacing.lg,
    avatarSize: isCompact ? 38 : 44,
  };
}
