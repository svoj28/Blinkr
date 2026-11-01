import { useSyncExternalStore } from 'react';

import { sessionStorage } from '@/lib/session-storage';

/**
 * Accounts signed in on this device, for "Switch account".
 * Each keeps its latest refresh token (stored next to Supabase's own session, in the
 * same storage), so switching doesn't need the password again.
 */
export type SavedAccount = {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  /** Built-in avatar id, or null for initials. */
  avatar: string | null;
  refreshToken: string;
};

const STORAGE_KEY = 'blinkr.saved-accounts';
const listeners = new Set<() => void>();

function read(): SavedAccount[] {
  try {
    const raw = sessionStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

let accounts: SavedAccount[] = read();

function write(next: SavedAccount[]) {
  accounts = next;
  try {
    sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Kept in memory for this session.
  }
  listeners.forEach((listener) => listener());
}

export function getSavedAccounts(): SavedAccount[] {
  return accounts;
}

/** Adds the account, or updates the fields given (undefined fields are left as they are). */
export function saveAccount(userId: string, changes: Partial<Omit<SavedAccount, 'userId'>>) {
  const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
  const existing = accounts.find((a) => a.userId === userId);

  if (!existing) {
    const added: SavedAccount = {
      userId,
      email: '',
      username: '',
      displayName: '',
      avatarColor: '#5F646B',
      avatar: null,
      refreshToken: '',
      ...defined,
    };
    return write([...accounts, added]);
  }

  const unchanged = Object.entries(defined).every(([key, value]) => existing[key as keyof SavedAccount] === value);
  if (!unchanged) write(accounts.map((a) => (a.userId === userId ? { ...a, ...defined } : a)));
}

export function removeSavedAccount(userId: string) {
  if (accounts.some((a) => a.userId === userId)) write(accounts.filter((a) => a.userId !== userId));
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useSavedAccounts(): SavedAccount[] {
  return useSyncExternalStore(subscribe, getSavedAccounts, () => []);
}
