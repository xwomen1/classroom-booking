/* eslint-env jest */
import {
  addNotification,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
} from '../../src/modules/notifications';
import {
  openPriorityBanner,
  presentPriorityNotification,
  subscribePriorityBannerOpen,
  subscribePriorityBanners,
  type PriorityBanner,
} from '../../src/modules/notifications/services/priorityBanner';
import { getNotificationTone } from '../../src/modules/notifications/services/notificationTone';
import { resetStorage, seedConfiguration } from '../support/testUtils';

beforeEach(async () => {
  await resetStorage();
});

describe('notificationRepository', () => {
  test('creates a single welcome notification on first read', async () => {
    const first = await getNotifications('user');
    const second = await getNotifications('user');
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ id: 'welcome-user', read: false });
    expect(second).toEqual(first);
  });

  test('addNotification prepends with a resolved tone', async () => {
    await addNotification('user', 'Yêu cầu đã được duyệt', 'Phòng 101.');
    await addNotification('user', 'Yêu cầu bị từ chối', 'Phòng 102.');
    const items = await getNotifications('user');
    expect(items.map(item => item.tone)).toEqual(['negative', 'positive', undefined]);
    expect(items[0].title).toBe('Yêu cầu bị từ chối');
  });

  test('explicit tone wins over keyword detection', async () => {
    await addNotification('user', 'Yêu cầu bị từ chối', 'x', 'neutral');
    expect((await getNotifications('user'))[0].tone).toBe('neutral');
  });

  test('notifications are isolated per user', async () => {
    await addNotification('admin', 'Có yêu cầu đặt phòng mới', 'x');
    expect(await getUnreadCount('admin')).toBe(2);
    expect(await getUnreadCount('user')).toBe(1);
  });

  test('nothing is stored while notifications are disabled', async () => {
    await seedConfiguration({ notificationsEnabled: false });
    await addNotification('user', 'Yêu cầu đã được duyệt', 'x');
    expect(await getNotifications('user')).toHaveLength(1);
  });

  test('markAllNotificationsRead clears the unread count', async () => {
    await addNotification('user', 'A', 'x');
    await addNotification('user', 'B', 'y');
    expect(await getUnreadCount('user')).toBe(3);
    await markAllNotificationsRead('user');
    expect(await getUnreadCount('user')).toBe(0);
  });

  test('a failing banner listener does not roll back the stored notification', async () => {
    const unsubscribe = subscribePriorityBanners(() => { throw new Error('UI crashed'); });
    await expect(addNotification('user', 'A', 'x')).resolves.toBeUndefined();
    expect((await getNotifications('user'))[0].title).toBe('A');
    unsubscribe();
  });
});

describe('priorityBanner', () => {
  test('listeners receive banners until they unsubscribe', async () => {
    const received: PriorityBanner[] = [];
    const unsubscribe = subscribePriorityBanners(banner => received.push(banner));
    await presentPriorityNotification('Yêu cầu đã được duyệt', 'Phòng 101.');
    unsubscribe();
    await presentPriorityNotification('Khác', 'x');
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ title: 'Yêu cầu đã được duyệt', tone: 'positive' });
  });

  test('openPriorityBanner notifies open listeners', () => {
    const opened = jest.fn();
    const unsubscribe = subscribePriorityBannerOpen(opened);
    const banner: PriorityBanner = { id: '1', title: 't', message: 'm', tone: 'neutral' };
    openPriorityBanner(banner);
    unsubscribe();
    openPriorityBanner(banner);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledWith(banner);
  });
});

describe('getNotificationTone', () => {
  test.each([
    ['Đã thu hồi quyền tự tạo mã', '', 'negative'],
    ['Đã ghi nhận vắng mặt', '', 'negative'],
    ['Yêu cầu bảo trì chưa được tiếp nhận', '', 'negative'],
    ['Đã thống nhất lịch nhận khóa', '', 'positive'],
    ['Hồ sơ đã được cập nhật', '', 'positive'],
    ['Đặt phòng đã được đổi phòng', '', 'attention'],
    ['Yêu cầu đã được hủy', 'user đã hủy yêu cầu phòng 101.', 'attention'],
    ['Chào mừng đến ứng dụng đặt phòng', 'Tài khoản của bạn đã sẵn sàng.', 'neutral'],
  ])('%s → %s', (title, message, tone) => {
    expect(getNotificationTone({ title, message })).toBe(tone);
  });

  test('matching is case-insensitive and negative wins over positive', () => {
    expect(getNotificationTone({ title: 'YÊU CẦU ĐƯỢC DUYỆT', message: '' })).toBe('positive');
    expect(getNotificationTone({ title: 'Được duyệt nhưng thất bại', message: '' })).toBe('negative');
  });
});
