// Push notifications are phone-only. On web these are no-ops with the same API as push.ts.

export async function registerForPushNotifications() {
  return 'web' as const;
}

export async function unregisterPushNotifications() {}

export function usePushNotifications(_userId: string | null) {}
