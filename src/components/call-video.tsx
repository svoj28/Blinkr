import type { ComponentType } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
// Type-only: erased at build time, so it never loads the native module by itself.
import type { RTCVideoViewProps } from 'react-native-webrtc';

type CallVideoProps = {
  streamURL: string;
  /** Mirror your own front-camera preview, like a mirror. */
  mirror?: boolean;
  /** Draw on top of another video (the small self-view). */
  onTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

let RTCView: ComponentType<RTCVideoViewProps> | null | undefined;
function loadRTCView() {
  if (RTCView !== undefined) return RTCView;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RTCView = (require('react-native-webrtc') as { RTCView: ComponentType<RTCVideoViewProps> }).RTCView;
  } catch {
    RTCView = null;
  }
  return RTCView;
}

/** A live call video (yours or theirs), filling its box. */
export function CallVideo({ streamURL, mirror = false, onTop = false, style }: CallVideoProps) {
  const VideoView = loadRTCView();
  if (!VideoView) return <View style={style} />;
  return <VideoView streamURL={streamURL} mirror={mirror} objectFit="cover" zOrder={onTop ? 1 : 0} style={style} />;
}
