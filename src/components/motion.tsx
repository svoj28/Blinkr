import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  Keyframe,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/*
 * Blinkr's motion: quick, soft and never in the way. Springs settle fast without much
 * bounce, lists cascade in once, and everything follows the phone's "Reduce motion"
 * setting (Reanimated's default), where these become simple fades or nothing at all.
 */

/** A quick, barely-bouncy spring for presses and small movements. */
export const snappy = { damping: 18, stiffness: 260, mass: 0.6 } as const;

/** Items further down the first screen wait a little longer, up to this many steps. */
const MAX_STAGGER = 6;

/** Fades a list item up into place. Only the first few items on screen are staggered. */
export function EnterItem({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(Math.min(index, MAX_STAGGER) * 45)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Dialogs: a small fade and scale up, like a card set down on the page. */
export const popIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(220);

/** Bottom sheets slide up with a soft spring. */
export const sheetIn = SlideInDown.springify().damping(22).stiffness(220);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while held. */
  scaleTo?: number;
};

/** A Pressable that shrinks slightly while held and springs back, instead of just dimming. */
export function PressableScale({ scaleTo = 0.96, style, onPressIn, onPressOut, disabled, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, snappy);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    />
  );
}
