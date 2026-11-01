import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSignedImageUrl } from '@/lib/images';

type PhotoProps = {
  uri: string | null | undefined;
  /** Width ÷ height, when known up front (e.g. a photo just picked). Otherwise read on load. */
  aspectRatio?: number;
  /** Keeps very tall or very wide photos to a sensible shape. */
  minAspect?: number;
  maxAspect?: number;
  style?: StyleProp<ViewStyle>;
  /** Tapping opens the photo full screen (default). */
  expandable?: boolean;
  accessibilityLabel?: string;
};

/** A rounded photo that sizes itself to the picture and opens full screen when tapped. */
export function Photo({
  uri,
  aspectRatio,
  minAspect = 0.75,
  maxAspect = 1.9,
  style,
  expandable = true,
  accessibilityLabel = 'Photo',
}: PhotoProps) {
  const theme = useTheme();
  const [loadedAspect, setLoadedAspect] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const ratio = Math.min(maxAspect, Math.max(minAspect, aspectRatio ?? loadedAspect ?? 4 / 3));

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        disabled={!expandable || !uri}
        accessibilityRole={expandable ? 'imagebutton' : 'image'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={expandable ? 'Opens the photo full screen' : undefined}
        style={[styles.frame, { aspectRatio: ratio, backgroundColor: theme.skeleton }, style]}>
        {uri ? (
          <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoad={({ nativeEvent }) => {
                const { width, height } = nativeEvent.source ?? {};
                if (width && height) setLoadedAspect(width / height);
              }}
            />
          </Animated.View>
        ) : (
          <ActivityIndicator color={theme.textSecondary} />
        )}
      </Pressable>
      {expandable && uri && <PhotoViewer uri={uri} visible={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}

/** A private chat photo: fetches a short-lived link first (only the two people in the chat can). */
export function ChatPhoto({ path, localUri, style }: { path: string | null; localUri?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const signed = useSignedImageUrl(localUri ? null : path);
  if (signed.isError) {
    return (
      <View style={[styles.frame, styles.missing, { backgroundColor: theme.skeleton }, style]}>
        <Ionicons name="image-outline" size={22} color={theme.textSecondary} />
        <ThemedText variant="caption" color="textSecondary">
          Photo unavailable
        </ThemedText>
      </View>
    );
  }
  return <Photo uri={localUri ?? signed.data} style={style} accessibilityLabel="Photo in chat" />;
}

/** Full-screen photo on black, closed by the × or the back gesture. */
export function PhotoViewer({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.viewer}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close photo" />
        <Image source={{ uri }} style={styles.full} resizeMode="contain" accessibilityLabel="Photo" />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          hitSlop={10}
          style={[styles.close, { top: insets.top + 12 }]}>
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  missing: { aspectRatio: 4 / 3, gap: 4 },
  viewer: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
