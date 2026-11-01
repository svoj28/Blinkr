import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { queryClient } from '@/lib/query-client';
import { unregisterPushNotifications } from '@/lib/push';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getSavedAccounts, removeSavedAccount, saveAccount } from '@/state/saved-accounts';

type SignUpInput = { email: string; password: string; username: string; displayName: string };

/**
 * Where the "Reset password" email link leaves you. While this is set, the app shows only the
 * reset-password screen: the link signs you in, but the app opens once the new password is saved.
 */
export type PasswordRecovery =
  | { status: 'verifying' }
  | { status: 'ready'; email: string | null }
  | { status: 'invalid'; message: string };

const RESET_PATH = 'reset-password';

/** The key=value pairs after "?" and "#" in a link (Supabase puts the tokens after "#"). */
function linkParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of url.split(/[?#]/).slice(1).join('&').split('&')) {
    const at = part.indexOf('=');
    if (at <= 0) continue;
    params[decodeURIComponent(part.slice(0, at))] = decodeURIComponent(part.slice(at + 1).replace(/\+/g, ' '));
  }
  return params;
}

type AuthContextValue = {
  session: Session | null;
  userId: string | null;
  /** True until the saved session (if any) has been restored on launch. */
  isLoading: boolean;
  /** Signs in. If someone is already signed in, their account stays saved for "Switch account". */
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true when Supabase requires the person to confirm their email first. */
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  /** Signs out of the current account on this device and forgets it. */
  signOut: () => Promise<void>;
  /** Switches to another account saved on this device, without asking for its password. */
  switchAccount: (userId: string) => Promise<void>;
  /** Emails a link for resetting the password (silently does nothing for unknown emails). */
  sendPasswordResetEmail: (email: string) => Promise<void>;
  /** Set after opening a reset link, until the new password is saved or the reset is abandoned. */
  passwordRecovery: PasswordRecovery | null;
  /** Saves the new password, then opens the app signed in with it. */
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  /** Leaves the reset without changing anything (signs out of the link's session). */
  cancelPasswordRecovery: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Keeps the saved-accounts list up to date with the latest refresh token. */
function rememberSession(session: Session) {
  const known = getSavedAccounts().find((a) => a.userId === session.user.id);
  const metadata = session.user.user_metadata ?? {};
  saveAccount(session.user.id, {
    email: session.user.email ?? undefined,
    refreshToken: session.refresh_token,
    // Only a first guess; the drawer replaces these with the real profile.
    username: known?.username ? undefined : metadata.username,
    displayName: known?.displayName ? undefined : metadata.display_name,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const userId = session?.user.id ?? null;
  const [passwordRecovery, setPasswordRecovery] = useState<PasswordRecovery | null>(null);
  // A reset link signs you in before the new password is saved. Hold that session back
  // so the app doesn't open until the reset has finished.
  const isRecovering = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    /** Handles a "Reset password" email link, whether it opened the app or arrived while open. */
    const handleLink = async (url: string | null) => {
      if (!url || !url.includes(RESET_PATH)) return false;
      const params = linkParams(url);
      if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname); // hide the tokens

      if (params.error || params.error_description) {
        const expired = /expired|invalid/i.test(`${params.error_code} ${params.error_description}`);
        setPasswordRecovery({
          status: 'invalid',
          message: expired
            ? 'This reset link has expired or was already used. Links work once, for an hour.'
            : params.error_description || 'This reset link didn’t work.',
        });
        return true;
      }
      if (params.type !== 'recovery' || !params.access_token || !params.refresh_token) return false;

      isRecovering.current = true;
      setPasswordRecovery({ status: 'verifying' });
      const { data, error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (error || !data.session) {
        isRecovering.current = false;
        setPasswordRecovery({ status: 'invalid', message: 'This reset link has expired or was already used.' });
      } else {
        setPasswordRecovery({ status: 'ready', email: data.session.user.email ?? null });
      }
      return true;
    };

    // On launch: follow a reset link if that's what opened the app, otherwise restore the saved session.
    Linking.getInitialURL()
      .then(handleLink)
      .catch(() => false)
      .then(async (handled) => {
        if (handled) return;
        const { data } = await supabase.auth.getSession();
        if (isRecovering.current) return;
        setSession(data.session);
        if (data.session) rememberSession(data.session);
      })
      .finally(() => setIsLoading(false));

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      handleLink(url).catch(() => {});
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isRecovering.current) return;
      setSession(newSession);
      if (newSession) rememberSession(newSession);
    });
    return () => {
      linkSubscription.remove();
      data.subscription.unsubscribe();
    };
  }, []);

  // Switched to another account: drop the previous person's cached data and refetch.
  const previousUserId = useRef(userId);
  useEffect(() => {
    if (previousUserId.current && userId && previousUserId.current !== userId) {
      queryClient.resetQueries();
    }
    previousUserId.current = userId;
  }, [userId]);

  const value: AuthContextValue = {
    session,
    userId,
    isLoading,

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },

    async signUp({ email, password, username, displayName }) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Read by the database trigger that creates the profile.
        options: { data: { username: username.toLowerCase(), display_name: displayName.trim() } },
      });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    },

    async signOut() {
      await unregisterPushNotifications().catch(() => {});
      if (userId) removeSavedAccount(userId);
      // "local": only this device. Other phones, and other saved accounts, stay signed in.
      await supabase.auth.signOut({ scope: 'local' });
      queryClient.clear(); // don't show the previous person's data to the next one
    },

    async switchAccount(targetId) {
      if (targetId === userId) return;
      const account = getSavedAccounts().find((a) => a.userId === targetId);
      if (!account) throw new Error('That account is no longer saved on this device.');

      const { error } = await supabase.auth.refreshSession({ refresh_token: account.refreshToken });
      if (error) {
        removeSavedAccount(targetId);
        throw new Error(`You’ve been signed out of @${account.username || account.email}. Add the account again to use it.`);
      }
      // The new session arrives through onAuthStateChange; push re-registers for the new user.
    },

    async sendPasswordResetEmail(email) {
      // The link in the email comes back to the reset-password screen (see handleLink).
      const redirectTo = Linking.createURL(`/${RESET_PATH}`);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
    },

    passwordRecovery,

    async completePasswordRecovery(newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Done: let the app open, signed in with the new password.
      isRecovering.current = false;
      const { data } = await supabase.auth.getSession();
      setPasswordRecovery(null);
      setSession(data.session);
      if (data.session) rememberSession(data.session);
    },

    async cancelPasswordRecovery() {
      if (passwordRecovery?.status === 'ready' || passwordRecovery?.status === 'verifying') {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      isRecovering.current = false;
      setPasswordRecovery(null);
      // Back to whoever was signed in before (normally nobody).
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
