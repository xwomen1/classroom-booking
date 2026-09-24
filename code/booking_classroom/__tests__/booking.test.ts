import { storage } from '../src/core/storage/jsonStorage';
import {
  createTemporaryPin,
  grantUserPinPermission,
} from '../src/modules/access_control';
import {
  createBooking,
  getBookingsForUser,
  reviewBooking,
  toLocalDateTime,
} from '../src/modules/booking';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

describe('local booking and temporary PIN flow', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  test('creates, approves and issues a six-digit PIN for the requester', async () => {
    const date = dateAfter(1);
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date,
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Họp nhóm đồ án',
    });

    await expect(createTemporaryPin(booking.id, 'admin', 'admin')).rejects.toThrow(
      'Chỉ tạo mã cho yêu cầu đã được duyệt.',
    );
    await reviewBooking(booking.id, 'APPROVED', 'admin');
    const approved = await createTemporaryPin(booking.id, 'admin', 'admin');

    expect(approved.temporaryPin?.code).toMatch(/^\d{6}$/);
    expect(new Date(approved.temporaryPin!.validFrom).getTime()).toBe(
      toLocalDateTime(date, '08:00').getTime() - 10 * 60_000,
    );
    expect(new Date(approved.temporaryPin!.validUntil).getTime()).toBe(
      toLocalDateTime(date, '09:00').getTime() + 10 * 60_000,
    );
    await expect(getBookingsForUser('user')).resolves.toHaveLength(1);
    await expect(getBookingsForUser('another-user')).resolves.toHaveLength(0);
  });

  test('lets the requester create a PIN only after admin grants permission', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'User tự tạo mã',
    });
    await reviewBooking(booking.id, 'APPROVED', 'admin');

    await expect(
      createTemporaryPin(booking.id, 'user', 'user'),
    ).rejects.toThrow('User chưa được Admin cho phép tạo mã.');
    await grantUserPinPermission(booking.id, 'admin');
    const updated = await createTemporaryPin(booking.id, 'user', 'user');

    expect(updated.temporaryPin?.code).toMatch(/^\d{6}$/);
    expect(updated.temporaryPin?.createdBy).toBe('user');
  });

  test('rejects a room collision and dates outside the one-to-three-day window', async () => {
    const date = dateAfter(1);
    await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date,
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Buổi thứ nhất',
    });

    await expect(
      createBooking({
        requesterUsername: 'teacher02',
        roomId: 'room-a101',
        date,
        startTime: '08:30',
        endTime: '09:30',
        purpose: 'Bị trùng phòng',
      }),
    ).rejects.toThrow('Phòng đã có yêu cầu khác');
    await expect(
      createBooking({
        requesterUsername: 'teacher02',
        roomId: 'room-a101',
        date: dateAfter(4),
        startTime: '10:00',
        endTime: '11:00',
        purpose: 'Quá xa',
      }),
    ).rejects.toThrow('Chỉ được đặt trước từ 1 đến 3 ngày.');
  });
});
