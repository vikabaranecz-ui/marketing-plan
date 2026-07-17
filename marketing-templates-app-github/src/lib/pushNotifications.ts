import type { Reminder } from '../types';
import { supabase } from './cloudMemory';

export type PushNotificationStatus = 'loading' | 'unsupported' | 'disabled' | 'denied' | 'enabled';

const VAPID_PUBLIC_KEY = 'BBekV8DBj4dFkUx9TZ162s855pICXXYq5fS216Y9413mo5R6LZzOsKoyS7fNilGze3rdzkP-7TKBEUYHzrZRpQY';

const urlBase64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, character => character.charCodeAt(0));
};

export const getPushNotificationStatus = async (): Promise<PushNotificationStatus> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return 'disabled';
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'enabled' : 'disabled';
};

export const enablePushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported on this device');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error('The browser returned an incomplete push subscription');
  }

  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: serialized.endpoint,
    p_p256dh: serialized.keys.p256dh,
    p_auth_key: serialized.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
};

export const disablePushNotifications = async () => {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  const { error } = await supabase.rpc('unregister_push_subscription', { p_endpoint: endpoint });
  if (error) throw error;
  await subscription.unsubscribe();
};

export const syncPushReminders = async (reminders: Reminder[]) => {
  const payload = reminders
    .filter(reminder => !reminder.dismissedAt)
    .map(reminder => ({
      reminder_id: reminder.id,
      title: reminder.title,
      body: reminder.note ?? '',
      target_label: '',
      remind_at: reminder.remindAt,
    }));
  const { error } = await supabase.rpc('sync_push_reminders', { p_reminders: payload });
  if (error) throw error;
};
