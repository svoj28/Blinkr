// On iOS and Android the login session is saved with expo-sqlite's localStorage,
// as recommended by https://docs.expo.dev/guides/using-supabase/
import 'expo-sqlite/localStorage/install';

export const sessionStorage = globalThis.localStorage;
