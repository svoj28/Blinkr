// Import only the weights Blinkr uses, so unused font files aren't bundled.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
import { Newsreader_700Bold } from '@expo-google-fonts/newsreader/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useIncomingCallListener } from '@/api/calls';
import { useProfile } from '@/api/profiles';
import { SetupScreen } from '@/components/setup-screen';
import { Fonts, getTheme } from '@/constants/theme';
import { type ColorScheme, ColorSchemeContext, useAppScheme } from '@/hooks/use-color-scheme';
import { AccentContext, useTheme } from '@/hooks/use-theme';
import { usePushNotifications } from '@/lib/push';
import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/state/auth-context';

// Keep the splash screen up until the fonts have loaded.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useAppScheme();
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Newsreader_400Regular_Italic,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
  });
  // If a font fails to load, the app still opens with the system font.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ColorSchemeContext.Provider value={scheme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemedApp scheme={scheme} />
          </AuthProvider>
        </QueryClientProvider>
      </ColorSchemeContext.Provider>
    </GestureHandlerRootView>
  );
}

/**
 * Colors the whole app with the signed-in person’s avatar color as the accent (their pick
 * under Edit profile → Background color), in light or dark mode. Signed out: the default green.
 */
function ThemedApp({ scheme }: { scheme: ColorScheme }) {
  const { userId } = useAuth();
  const { data: profile } = useProfile(isSupabaseConfigured ? userId : null);
  const accent = profile?.avatarColor ?? null;
  const theme = getTheme(scheme, accent);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  // Match the navigation chrome (headers, backgrounds, fonts) to the Blinkr look.
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.tint,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
    },
    fonts: {
      regular: { fontFamily: Fonts.regular, fontWeight: '400' },
      medium: { fontFamily: Fonts.medium, fontWeight: '500' },
      bold: { fontFamily: Fonts.bold, fontWeight: '700' },
      heavy: { fontFamily: Fonts.heavy, fontWeight: '800' },
    },
  };

  return (
    <AccentContext.Provider value={accent}>
      <ThemeProvider value={navigationTheme}>
        {/* Follows the in-app appearance setting, which can differ from the phone's. */}
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {isSupabaseConfigured ? <RootNavigator /> : <SetupScreen />}
      </ThemeProvider>
    </AccentContext.Provider>
  );
}

/** Signed-out people only see sign-in / sign-up; signed-in people only see the app. */
function RootNavigator() {
  const theme = useTheme();
  const { userId, isLoading, passwordRecovery } = useAuth();
  const isSignedIn = !!userId;
  // A reset link was opened: only the new-password screen is available until it's done.
  const isRecovering = !!passwordRecovery;
  const recoveryFailed = passwordRecovery?.status === 'invalid';

  usePushNotifications(userId);
  useIncomingCallListener(userId); // Closed Blinkers ringing you while the app is open

  // Wait until the saved session has been restored, so we don't flash the sign-in screen.
  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: { fontFamily: Fonts.serif, fontSize: 22 },
        // The iOS slide-in on Android too (iOS already does this), so screens feel like pages turning.
        animation: 'ios_from_right',
      }}>
      <Stack.Protected guard={isSignedIn && !isRecovering}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Feed' }} />
        <Stack.Screen name="blink/[id]" options={{ title: 'Blink' }} />
        <Stack.Screen name="blink/edit/[id]" options={{ title: 'Edit Blink', presentation: 'modal' }} />
        <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen
          name="call/[id]"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit profile', presentation: 'modal' }} />
        <Stack.Screen name="friends" options={{ title: 'Friends' }} />
        <Stack.Screen name="closed-blinkers/index" options={{ title: 'Closed Blinkers' }} />
        <Stack.Screen name="closed-blinkers/add" options={{ title: 'Add a Closed Blinker' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="add-account" options={{ title: 'Add account', presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn && (!isRecovering || recoveryFailed)}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, title: 'Sign in' }} />
        <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      </Stack.Protected>

      <Stack.Protected guard={isRecovering}>
        <Stack.Screen
          name="reset-password"
          options={{ title: 'New password', headerBackVisible: false, gestureEnabled: false }}
        />
      </Stack.Protected>

      <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
    </Stack>
  );
}
