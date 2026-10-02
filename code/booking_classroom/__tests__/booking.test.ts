import { storage } from '../src/core/storage/jsonStorage';
import {
  createTemporaryPin,
  grantRoomPinPermission,
  hasRoomPinPermission,
  revokeRoomPinPermission,
} from '../src/modules/access_control';
import {
  createBooking,
  cancelFutureRecurringBookings,
  confirmBookingCheckIn,
  confirmBookingNoShow,
  getBookingsForUser,
  getBookingTimeCategory,
  isBookingStillActive,
  reviewBooking,
  reviewRecurringSeries,
  toLocalDateTime,
  updatePendingRecurringBookings,
} from '../src/modules/booking';
import { registerAccount } from '../src/modules/auth';
import { assignSmartLockToRoom } from '../src/modules/smart_lock';

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
    await assignSmartLockToRoom('room-a101', 'admin');
  });

  test('expires an unreviewed request when its session starts', () => {
    const booking = {
      id: 'pending-at-start',
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: '2030-01-01',
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Kiểm thử thời hạn duyệt',
      status: 'PENDING' as const,
      createdAt: '2029-12-01T00:00:00.000Z',
    };

    expect(isBookingStillActive(booking, new Date('2030-01-01T07:59:00'))).toBe(true);
    expect(isBookingStillActive(booking, new Date('2030-01-01T08:00:00'))).toBe(false);
    expect(isBookingStillActive(
      { ...booking, status: 'APPROVED' },
      new Date('2030-01-01T08:30:00'),
    )).toBe(true);
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

  test('approving a booking grants room-scoped PIN permission that admin can revoke', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'User tự tạo mã',
    });
    await reviewBooking(booking.id, 'APPROVED', 'admin');
    await expect(hasRoomPinPermission('user', 'room-a101')).resolves.toBe(true);
    await revokeRoomPinPermission('user', 'room-a101', 'admin');
    await expect(
      createTemporaryPin(booking.id, 'user', 'user'),
    ).rejects.toThrow('Quyền tự tạo mã tại phòng này đã bị thu hồi');
    await grantRoomPinPermission('user', 'room-a101', 'admin');
    const updated = await createTemporaryPin(booking.id, 'user', 'user');

    expect(updated.temporaryPin?.code).toMatch(/^\d{6}$/);
    expect(updated.temporaryPin?.createdBy).toBe('user');
  });

  test('only sends a PIN for the room currently attached to the single SmartLock', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '13:00',
      endTime: '14:00',
      purpose: 'Kiểm tra liên kết khóa',
    });
    await reviewBooking(booking.id, 'APPROVED', 'admin');
    await assignSmartLockToRoom('room-floor-1-2', 'admin');

    await expect(
      createTemporaryPin(booking.id, 'admin', 'admin'),
    ).rejects.toThrow('Phòng chưa được gắn với SmartLock');
  });

  test('creates weekly recurring bookings when repeatWeekly is enabled', async () => {
    const firstDate = dateAfter(1);
    await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: firstDate,
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học lặp lại',
      repeatWeekly: true,
      repeatWeeks: 3,
    });

    const bookings = await getBookingsForUser('user');
    const recurring = bookings.filter(item => item.roomId === 'room-a101');
    expect(recurring).toHaveLength(3);
    expect(new Set(recurring.map(item => item.recurringSeriesId)).size).toBe(1);
    expect(recurring.map(item => item.date).sort()).toEqual([
      firstDate,
      dateAfter(8),
      dateAfter(15),
    ]);
    expect(recurring.map(item => item.recurringWeekIndex).sort()).toEqual([0, 1, 2]);
  });

  test('updates all future pending occurrences in a recurring series', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học lặp lại',
      repeatWeekly: true,
      repeatWeeks: 3,
    });

    await expect(updatePendingRecurringBookings(booking.id, 'user', {
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'Đổi lịch học',
    })).resolves.toBe(3);

    const updated = (await getBookingsForUser('user'))
      .filter(item => item.recurringSeriesId === booking.recurringSeriesId);
    expect(updated).toHaveLength(3);
    expect(updated.every(item => item.startTime === '10:00' && item.endTime === '11:00')).toBe(true);
    expect(updated.every(item => item.purpose === 'Đổi lịch học')).toBe(true);
  });

  test('does not partially update a series when one future occurrence conflicts', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học lặp lại',
      repeatWeekly: true,
      repeatWeeks: 3,
    });
    const storedBookings = JSON.parse((await storage.getItem('booking.records')) ?? '[]') as Array<Record<string, unknown>>;
    storedBookings.push({
      id: 'existing-future-booking',
      requesterUsername: 'teacher03',
      roomId: 'room-a101',
      date: dateAfter(8),
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'Lịch khác',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });
    await storage.setItem('booking.records', JSON.stringify(storedBookings));

    await expect(updatePendingRecurringBookings(booking.id, 'user', {
      startTime: '10:00',
      endTime: '11:00',
      purpose: 'Đổi lịch học',
    })).rejects.toThrow('Phòng đã có yêu cầu khác');

    const unchanged = (await getBookingsForUser('user'))
      .filter(item => item.recurringSeriesId === booking.recurringSeriesId);
    expect(unchanged.every(item => item.startTime === '08:00' && item.purpose === 'Lớp học lặp lại')).toBe(true);
  });

  test('cancels future occurrences together and revokes an issued PIN', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học lặp lại',
      repeatWeekly: true,
      repeatWeeks: 3,
    });
    await reviewBooking(booking.id, 'APPROVED', 'admin');
    await createTemporaryPin(booking.id, 'admin', 'admin');

    await expect(cancelFutureRecurringBookings(booking.id, 'user')).resolves.toBe(3);

    const cancelled = (await getBookingsForUser('user'))
      .filter(item => item.recurringSeriesId === booking.recurringSeriesId);
    expect(cancelled).toHaveLength(3);
    expect(cancelled.every(item => item.status === 'CANCELLED')).toBe(true);
    expect(cancelled.find(item => item.id === booking.id)?.temporaryPin?.revokedAt).toBeDefined();
  });

  test('admin can approve every pending occurrence in a series at once', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học lặp lại',
      repeatWeekly: true,
      repeatWeeks: 3,
    });

    await expect(reviewRecurringSeries(booking.recurringSeriesId!, 'APPROVED', 'admin')).resolves.toBe(3);

    const approved = (await getBookingsForUser('user'))
      .filter(item => item.recurringSeriesId === booking.recurringSeriesId);
    expect(approved.every(item => item.status === 'APPROVED' && item.reviewedBy === 'admin')).toBe(true);
    await expect(hasRoomPinPermission('user', 'room-a101')).resolves.toBe(true);
  });

  test('admin can reject every pending occurrence in a series at once', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học lặp lại',
      repeatWeekly: true,
      repeatWeeks: 3,
    });

    await expect(reviewRecurringSeries(booking.recurringSeriesId!, 'REJECTED', 'admin')).resolves.toBe(3);

    const rejected = (await getBookingsForUser('user'))
      .filter(item => item.recurringSeriesId === booking.recurringSeriesId);
    expect(rejected.every(item => item.status === 'REJECTED' && item.reviewedBy === 'admin')).toBe(true);
  });

  test('does not approve any occurrence when one series date conflicts with an approved booking', async () => {
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: dateAfter(1),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học lặp lại',
      repeatWeekly: true,
      repeatWeeks: 3,
    });
    const storedBookings = JSON.parse((await storage.getItem('booking.records')) ?? '[]') as Array<Record<string, unknown>>;
    storedBookings.push({
      id: 'approved-future-booking',
      requesterUsername: 'teacher04',
      roomId: 'room-a101',
      date: dateAfter(8),
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lịch đã duyệt',
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
    });
    await storage.setItem('booking.records', JSON.stringify(storedBookings));

    await expect(reviewRecurringSeries(booking.recurringSeriesId!, 'APPROVED', 'admin'))
      .rejects.toThrow('trùng lịch đã duyệt; chưa lượt nào được duyệt');

    const unchanged = (await getBookingsForUser('user'))
      .filter(item => item.recurringSeriesId === booking.recurringSeriesId);
    expect(unchanged.every(item => item.status === 'PENDING')).toBe(true);
  });

  test('requires the configured grace period before marking no-show and releases the slot', async () => {
    const date = dateAfter(1);
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date,
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học',
    });
    await reviewBooking(booking.id, 'APPROVED', 'admin');
    await createTemporaryPin(booking.id, 'admin', 'admin');
    const start = toLocalDateTime(date, '08:00');

    await expect(confirmBookingNoShow(booking.id, 'admin', new Date(start.getTime() + 14 * 60_000)))
      .rejects.toThrow('sau 15 phút');
    const marked = await confirmBookingNoShow(booking.id, 'admin', new Date(start.getTime() + 16 * 60_000));

    expect(marked.status).toBe('NO_SHOW');
    expect(marked.noShowMarkedBy).toBe('admin');
    expect(marked.temporaryPin?.revokedAt).toBe(marked.noShowAt);
    expect(getBookingTimeCategory(marked)).toBe('CANCELLED');
    await expect(createBooking({
      requesterUsername: 'user',
      roomId: 'room-a101',
      date,
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lượt thay thế sau khi vắng',
    })).resolves.toMatchObject({ status: 'PENDING' });
  });

  test('manual Admin check-in prevents no-show confirmation', async () => {
    const date = dateAfter(1);
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-b202',
      date,
      startTime: '08:00',
      endTime: '09:00',
      purpose: 'Lớp học',
    });
    await reviewBooking(booking.id, 'APPROVED', 'admin');
    const start = toLocalDateTime(date, '08:00');
    const checkIn = await confirmBookingCheckIn(booking.id, 'admin', new Date(start.getTime() + 5 * 60_000));

    expect(checkIn.checkedInAt).toBe(new Date(start.getTime() + 5 * 60_000).toISOString());
    expect(checkIn.checkInConfirmedBy).toBe('admin');
    await expect(confirmBookingNoShow(booking.id, 'admin', new Date(start.getTime() + 20 * 60_000)))
      .rejects.toThrow('đã có check-in');
  });

  test('rejects a room collision and dates outside the one-to-three-day window', async () => {
    await registerAccount({ username: 'teacher02', password: '1234' });
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
