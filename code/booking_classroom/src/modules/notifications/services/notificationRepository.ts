import { apiRequest, useRemoteApi } from '../../../core/api/client';
import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import type { NotificationItem } from '../model/notificationItem';
import { getConfiguration } from '../../configuration/services/configurationRepository';
import { presentPriorityNotification } from './priorityBanner';

const NOTIFICATION_KEY_PREFIX = 'notifications.';

function keyFor(username: string) {
  return `${NOTIFICATION_KEY_PREFIX}${username}`;
}

export async function getNotifications(
  username: string,
): Promise<NotificationItem[]> {
  if (useRemoteApi()) {
    return apiRequest<NotificationItem[]>('/api/notifications');
  }
  const stored = await readJson<NotificationItem[] | null>(
    keyFor(username),
    null,
  );
  if (stored) {
    return stored;
  }

  const welcome: NotificationItem = {
    id: `welcome-${username}`,
    title: 'Chào mừng đến ứng dụng đặt phòng',
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
  if (useRemoteApi()) {
    const created = await apiRequest<NotificationItem | undefined>('/api/notifications', {
      method: 'POST',
      body: { username, title, message },
    });
    if (created) {
      await presentPriorityNotification(title, message);
    }
    return;
  }
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
  try {
    await presentPriorityNotification(title, message);
  } catch {
    // The in-app list is already saved. A banner failure must not roll back the action.
  }
}

export async function markAllNotificationsRead(
  username: string,
): Promise<void> {
  if (useRemoteApi()) {
    await apiRequest('/api/notifications/read', { method: 'POST' });
    return;
  }
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
