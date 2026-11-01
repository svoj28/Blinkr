import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with values from .env, so you never have to edit config by hand:
 *   EAS_PROJECT_ID  – links the app to your Expo project (push notifications, store builds)
 *   APP_BUNDLE_ID   – the app's unique ID on the App Store and Google Play
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID?.trim() || undefined;
  const bundleId = process.env.APP_BUNDLE_ID?.trim() || 'com.vhbc.blinkr';

  return {
    ...config,
    name: config.name ?? 'Blinkr',
    slug: config.slug ?? 'blinkr',
    ios: { ...config.ios, bundleIdentifier: bundleId },
    android: { ...config.android, package: bundleId },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-notifications', { color: '#17594A' }],
      // Scanning QR codes to add Closed Blinkers. No microphone needed.
      [
        'expo-camera',
        {
          cameraPermission: 'Allow $(PRODUCT_NAME) to use your camera to scan Closed Blinker QR codes.',
          recordAudioAndroid: false,
        },
      ],
      // Voice and video calls with Closed Blinkers (peer-to-peer WebRTC).
      [
        '@config-plugins/react-native-webrtc',
        {
          cameraPermission: 'Allow $(PRODUCT_NAME) to use your camera for video calls with your Closed Blinkers.',
          microphonePermission: 'Allow $(PRODUCT_NAME) to use your microphone for calls with your Closed Blinkers.',
        },
      ],
    ],
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
