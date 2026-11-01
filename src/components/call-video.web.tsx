import { View, type StyleProp, type ViewStyle } from 'react-native';

type CallVideoProps = {
  streamURL: string;
  mirror?: boolean;
  onTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Calls are phone-only, so there's no video to show on the web. */
export function CallVideo({ style }: CallVideoProps) {
  return <View style={style} />;
}
