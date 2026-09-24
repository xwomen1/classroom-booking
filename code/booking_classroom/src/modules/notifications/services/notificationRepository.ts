import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import type { NotificationItem } from '../model/notificationItem';
import { getConfiguration } from '../../configuration/services/configurationRepository';

const NOTIFICATION_KEY_PREFIX = 'notifications.';

function keyFor(username: string) {
  return `${NOTIFICATION_KEY_PREFIX}${username}`;
}

export async function getNotifications(
  username: string,
): Promise<NotificationItem[]> {
  const stored = await readJson<NotificationItem[] | null>(
    keyFor(username),
    null,
  );
  if (stored) {
    return stored;
  }

  const welcome: NotificationItem = {
    id: `welcome-${username}`,
    title: 'Chào mừng đến booking_classroom',
    message: 'Tài khoản của bạn đã sẵn sàng để sử dụng.',
    createdAt: new Date().toISOString(),
    read: false,
  };
  await writeJson(keyFor(username), [welcome]);
  return [welcome];
}

export async function addNotification(
  username: string,
  title: string,
  message: string,
): Promise<void> {
  if (!(await getConfiguration()).notificationsEnabled) return;
  const notifications = await getNotifications(username);
  const item: NotificationItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  };
  await writeJson(keyFor(username), [item, ...notifications]);
}

export async function markAllNotificationsRead(
  username: string,
): Promise<void> {
  const notifications = await getNotifications(username);
  await writeJson(
    keyFor(username),
    notifications.map(item => ({ ...item, read: true })),
  );
}

export async function getUnreadCount(username: string): Promise<number> {
  const notifications = await getNotifications(username);
  return notifications.filter(item => !item.read).length;
}
