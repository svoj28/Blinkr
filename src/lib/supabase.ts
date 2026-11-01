import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { sessionStorage } from '@/lib/session-storage';

// Set these in .env (see .env.example). They are safe to ship in the app:
// row-level security in supabase/blinkr-schema.sql protects the data.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

/** False until both Supabase keys are in .env. The app then shows setup instructions instead. */
export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && supabaseKey.length > 20;

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://not-configured.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'not-configured',
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Only refresh the login session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
