import { createContext, useContext, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import { sessionStorage } from '@/lib/session-storage';

export type ColorScheme = 'light' | 'dark';
/** What the person picked in Settings. "system" follows the phone. */
export type AppearancePreference = 'system' | ColorScheme;

/**
 * The app reads the color scheme once, in the root layout, and shares it
 * through this context. Every screen then switches themes together. (Subscribing in
 * every component separately can leave some of them stale, especially on web.)
 */
export const ColorSchemeContext = createContext<ColorScheme>('light');

function subscribeToSystem(onChange: () => void) {
  const subscription = Appearance.addChangeListener(onChange);
  return () => subscription.remove();
}

function getSystemScheme(): ColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

// --- Appearance preference (saved on the device) ---

const PREFERENCE_KEY = 'blinkr.appearance';
const preferenceListeners = new Set<() => void>();

function readPreference(): AppearancePreference {
  try {
    const saved = sessionStorage?.getItem(PREFERENCE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

let preference: AppearancePreference = readPreference();

function subscribeToPreference(onChange: () => void) {
  preferenceListeners.add(onChange);
  return () => preferenceListeners.delete(onChange);
}

export function setAppearancePreference(next: AppearancePreference) {
  preference = next;
  try {
    sessionStorage?.setItem(PREFERENCE_KEY, next);
  } catch {
    // Not saved, but still applied for this session.
  }
  preferenceListeners.forEach((listener) => listener());
}

export function useAppearancePreference(): AppearancePreference {
  return useSyncExternalStore<AppearancePreference>(subscribeToPreference, () => preference, () => 'system');
}

/** Root layout only: the scheme to use, from the saved preference or the phone's setting. */
export function useAppScheme(): ColorScheme {
  const system = useSyncExternalStore<ColorScheme>(subscribeToSystem, getSystemScheme, () => 'light');
  const chosen = useAppearancePreference();
  return chosen === 'system' ? system : chosen;
}

/** Everywhere else: the app-wide color scheme. */
export function useColorScheme(): ColorScheme {
  return useContext(ColorSchemeContext);
}
