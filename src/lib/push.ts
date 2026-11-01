import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
// Type-only import: erased at build time, so it never loads the module by itself.
import type * as NotificationsModule from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { NotificationType } from '@/types';

type PushData = {
  type?: NotificationType;
  blinkId?: string | null;
  conversationId?: string | null;
  actorId?: string | null;
  callId?: string | null;
};

/**
 * Expo Go on Android throws as soon as expo-notifications is imported (SDK 53+), so the
 * module is loaded lazily and never there. Everything else in the app keeps working;
 * install a development or preview build to get push on Android.
 */
const isExpoGoOnAndroid =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let notificationsModule: typeof NotificationsModule | null | undefined;

function loadNotifications(): typeof NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (isExpoGoOnAndroid) {
    notificationsModule = null;
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof NotificationsModule;
  // Show notifications as banners even while Blinkr is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationsModule = Notifications;
  return Notifications;
}

let registeredToken: string | null = null;

/**
 * Asks for permission and saves this phone's Expo push token in Supabase.
 * Returns why it was skipped when push can't work here.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) return 'simulator';
  const Notifications = loadNotifications();
  if (!Notifications) return 'expo-go-android';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'missing-eas-project-id';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Blinkr',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return 'permission-denied';

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_push_token', { push_token: token });
  if (error) throw error;
  registeredToken = token;
  return 'registered';
}

/** Stops pushes to this phone (called on sign-out). */
export async function unregisterPushNotifications() {
  if (!registeredToken) return;
  await supabase.rpc('unregister_push_token', { push_token: registeredToken });
  registeredToken = null;
}

function openFromNotification(data: PushData) {
  if (data.type === 'call' && data.callId) router.navigate(`/call/${data.callId}`);
  else if (data.type === 'closed_request' || data.type === 'closed_accept') router.push('/closed-blinkers');
  else if (data.type === 'message' && data.conversationId) router.push(`/chat/${data.conversationId}`);
  else if ((data.type === 'like' || data.type === 'comment') && data.blinkId) router.push(`/blink/${data.blinkId}`);
  else if (data.type === 'follow' && data.actorId) router.push(`/user/${data.actorId}`);
  else router.navigate('/notifications');
}

/**
 * Registers for push once signed in, and opens the right screen when a notification is tapped.
 * Runs again after switching accounts, which moves this phone's pushes to the new account.
 */
export function usePushNotifications(userId: string | null) {
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    registerForPushNotifications()
      .then((result) => {
        if (result !== 'registered') console.info(`[Blinkr] Push notifications not enabled: ${result}`);
      })
      .catch((error) => console.warn('[Blinkr] Push registration failed', error));

    const Notifications = loadNotifications();
    if (!Notifications) return;

    const open = (response: NotificationsModule.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handledId.current === id) return;
      handledId.current = id;
      openFromNotification(response.notification.request.content.data as PushData);
    };

    // A notification tapped while the app was closed, then any tapped while it's open.
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [userId]);
}
