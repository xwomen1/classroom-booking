import type { NotificationItem, NotificationTone } from '../model/notificationItem';

type NotificationCopy = Pick<NotificationItem, 'title' | 'message' | 'tone'>;

function normalizedCopy(notification: NotificationCopy): string {
  return `${notification.title} ${notification.message}`.toLocaleLowerCase('vi-VN');
}

function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some(phrase => text.includes(phrase));
}

/**
 * Older local data did not persist a tone. The fallback keeps those entries
 * semantically coloured instead of making every unread notification red.
 */
export function getNotificationTone(notification: NotificationCopy): NotificationTone {
  if (notification.tone) return notification.tone;
  const text = normalizedCopy(notification);

  if (containsAny(text, [
    'bị từ chối',
    'chưa được tiếp nhận',
    'đã thu hồi quyền',
    'ghi nhận vắng mặt',
    'không thể',
    'thất bại',
    'lỗi',
  ])) {
    return 'negative';
  }

  if (containsAny(text, [
    'được duyệt',
    'đã cấp mã mở cửa tạm thời',
    'đã ghi nhận check in',
    'đã ghi nhận check out',
    'smartlock: check in',
    'smartlock: check out',
    'đã xác nhận có mặt',
    'đăng ký thành công',
    'mật khẩu đã được thay đổi',
    'hồ sơ đã được cập nhật',
    'đã có lịch nhận khóa',
    'đã thống nhất lịch nhận khóa',
    'bảo trì đã được tiếp nhận',
  ])) {
    return 'positive';
  }

  if (containsAny(text, [
    'có yêu cầu',
    'có đề xuất',
    'đề xuất thời gian nhận khóa khác',
    'đổi phòng',
    'đã hủy',
    'cập nhật',
  ])) {
    return 'attention';
  }

  return 'neutral';
}

export const notificationToneTheme: Record<NotificationTone, {
  accent: string;
  background: string;
  border: string;
  label: string;
  mark: string;
}> = {
  positive: {
    accent: '#22864A',
    background: '#EAF7EF',
    border: '#9BCFAE',
    label: 'Đã hoàn tất',
    mark: '✓',
  },
  negative: {
    accent: '#B42318',
    background: '#FFF0F1',
    border: '#E9B2BA',
    label: 'Cần lưu ý',
    mark: '!',
  },
  attention: {
    accent: '#A86700',
    background: '#FFF8E7',
    border: '#E7C779',
    label: 'Cần xem',
    mark: '!',
  },
  neutral: {
    accent: '#2F6FED',
    background: '#EEF4FF',
    border: '#B9CEF5',
    label: 'Thông tin mới',
    mark: 'i',
  },
};
