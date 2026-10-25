/* eslint-env jest */
import {
  createBooking,
  getBookings,
  getBookingsForUser,
  getBookingTimeCategory,
  isBookingStillActive,
  toLocalDateTime,
} from '../../src/modules/booking';
import {
  getRoomOccupancy,
  meetsReplacementRoomRequirements,
} from '../../src/modules/booking/services/bookingRepository';
import { registerAccount } from '../../src/modules/auth';
import { createMaintenance } from '../../src/modules/schedule_maintenance';
import { DEMO_ROOMS } from '../../src/modules/room_management';
import { getNotifications } from '../../src/modules/notifications';
import { writeJson } from '../../src/core/storage/jsonStorage';
import {
  FIXED_NOW,
  dayOffset,
  freezeTime,
  makeBooking,
  resetStorage,
  seedBookings,
  seedConfiguration,
} from '../support/testUtils';

const tomorrow = () => dayOffset(1);

function input(overrides: Partial<Parameters<typeof createBooking>[0]> = {}) {
  return {
    requesterUsername: 'user',
    roomId: 'room-a101',
    date: tomorrow(),
    startTime: '09:00',
    endTime: '10:00',
    purpose: 'Seminar',
    ...overrides,
  };
}

beforeEach(async () => {
  await resetStorage();
  freezeTime();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createBooking – định dạng ngày giờ', () => {
  test.each([
    ['2030/01/11', '09:00', '10:00', 'Ngày phải có định dạng YYYY-MM-DD.'],
    ['11-01-2030', '09:00', '10:00', 'Ngày phải có định dạng YYYY-MM-DD.'],
    ['2030-01-11', '9:00', '10:00', 'Giờ phải có định dạng HH:mm hợp lệ.'],
    ['2030-01-11', '09:00', '24:00', 'Giờ phải có định dạng HH:mm hợp lệ.'],
    ['2030-01-11', '09:60', '10:00', 'Giờ phải có định dạng HH:mm hợp lệ.'],
    ['2030-02-30', '09:00', '10:00', 'Ngày hoặc khoảng thời gian đặt phòng không hợp lệ.'],
    ['2030-01-11', '10:00', '10:00', 'Ngày hoặc khoảng thời gian đặt phòng không hợp lệ.'],
    ['2030-01-11', '11:00', '10:00', 'Ngày hoặc khoảng thời gian đặt phòng không hợp lệ.'],
  ])('rejects date=%s start=%s end=%s', async (date, startTime, endTime, message) => {
    await expect(createBooking(input({ date, startTime, endTime }))).rejects.toThrow(message);
  });

  test('rejects a blank purpose and trims a valid one', async () => {
    await expect(createBooking(input({ purpose: '   ' }))).rejects.toThrow('Vui lòng nhập mục đích sử dụng phòng.');
    const booking = await createBooking(input({ purpose: '  Họp bộ môn  ' }));
    expect(booking.purpose).toBe('Họp bộ môn');
  });
});

describe('createBooking – cửa sổ đặt trước', () => {
  test.each([
    [0, false],
    [1, true],
    [2, true],
    [3, true],
    [4, false],
  ])('day offset %i accepted=%s with the default 1–3 day window', async (offset, accepted) => {
    const promise = createBooking(input({ date: dayOffset(offset), startTime: '12:00', endTime: '13:00' }));
    if (accepted) {
      await expect(promise).resolves.toMatchObject({ status: 'PENDING' });
    } else {
      await expect(promise).rejects.toThrow('Chỉ được đặt trước từ 1 đến 3 ngày.');
    }
  });

  test('follows a custom window from configuration', async () => {
    await seedConfiguration({ minAdvanceDays: 2, maxAdvanceDays: 5 });
    await expect(createBooking(input({ date: dayOffset(1) }))).rejects.toThrow('Chỉ được đặt trước từ 2 đến 5 ngày.');
    await expect(createBooking(input({ date: dayOffset(5) }))).resolves.toBeDefined();
  });

  test('same-day booking: rejects a slot that already ended', async () => {
    await seedConfiguration({ minAdvanceDays: 0 });
    await expect(createBooking(input({ date: dayOffset(0), startTime: '07:00', endTime: '08:00' })))
      .rejects.toThrow('Không thể đặt một khoảng thời gian đã kết thúc.');
  });

  test('calendar-day difference survives a month boundary', async () => {
    freezeTime(new Date(2030, 0, 31, 22, 0));
    await expect(createBooking(input({ date: '2030-02-01' }))).resolves.toBeDefined();
    await expect(createBooking(input({ date: '2030-02-04', startTime: '13:00', endTime: '14:00' })))
      .rejects.toThrow('Chỉ được đặt trước từ 1 đến 3 ngày.');
  });
});

describe('createBooking – xung đột', () => {
  test('back-to-back bookings in the same room do not overlap', async () => {
    await createBooking(input({ startTime: '09:00', endTime: '10:00' }));
    await registerAccount({ username: 'lecturer2', password: 'pass' });
    await expect(createBooking(input({ requesterUsername: 'lecturer2', startTime: '10:00', endTime: '11:00' })))
      .resolves.toBeDefined();
    await expect(createBooking(input({ requesterUsername: 'lecturer2', startTime: '08:00', endTime: '09:00' })))
      .resolves.toBeDefined();
  });

  test.each([
    ['08:30', '09:30'],
    ['09:30', '10:30'],
    ['09:15', '09:45'],
    ['08:00', '11:00'],
  ])('another user cannot take %s–%s when 09:00–10:00 is held', async (startTime, endTime) => {
    await createBooking(input());
    await registerAccount({ username: 'lecturer2', password: 'pass' });
    await expect(createBooking(input({ requesterUsername: 'lecturer2', startTime, endTime })))
      .rejects.toThrow('Phòng đã có yêu cầu khác trong khoảng thời gian này.');
  });

  test('a user cannot hold two rooms at overlapping times', async () => {
    await createBooking(input());
    await expect(createBooking(input({ roomId: 'room-floor-1-2', startTime: '09:30', endTime: '10:30' })))
      .rejects.toThrow('Bạn đã có lịch đặt khác trùng thời gian.');
  });

  test('cancelled, rejected and finished bookings do not block the slot', async () => {
    await seedBookings([
      makeBooking({ status: 'CANCELLED', date: tomorrow() }),
      makeBooking({ status: 'REJECTED', date: tomorrow() }),
      makeBooking({ status: 'NO_SHOW', date: tomorrow() }),
    ]);
    await expect(createBooking(input())).resolves.toBeDefined();
  });

  test('enforces the per-user active booking limit', async () => {
    await createBooking(input({ startTime: '09:00', endTime: '10:00' }));
    await createBooking(input({ startTime: '11:00', endTime: '12:00' }));
    await expect(createBooking(input({ startTime: '13:00', endTime: '14:00' })))
      .rejects.toThrow('Mỗi người chỉ có tối đa 2 yêu cầu đang chờ hoặc sắp dùng.');
  });

  test('expired bookings no longer count toward the limit', async () => {
    await seedBookings([
      makeBooking({ status: 'APPROVED', date: dayOffset(-1) }),
      makeBooking({ status: 'PENDING', date: dayOffset(-2) }),
    ]);
    await createBooking(input({ startTime: '09:00', endTime: '10:00' }));
    await expect(createBooking(input({ startTime: '11:00', endTime: '12:00' }))).resolves.toBeDefined();
  });

  test('rejects a room under maintenance status and an unknown room', async () => {
    const rooms = DEMO_ROOMS.map(room => room.id === 'room-a101' ? { ...room, status: 'MAINTENANCE' as const } : { ...room });
    await writeJson('rooms.records', rooms);
    await expect(createBooking(input())).rejects.toThrow('Phòng không tồn tại hoặc đang tạm khóa/bảo trì.');
    await expect(createBooking(input({ roomId: 'room-does-not-exist' })))
      .rejects.toThrow('Phòng không tồn tại hoặc đang tạm khóa/bảo trì.');
  });

  test('rejects a slot that overlaps scheduled maintenance', async () => {
    await createMaintenance({
      roomId: 'room-a101', date: tomorrow(), startTime: '09:30', endTime: '11:00',
      reason: 'Sửa máy chiếu', createdBy: 'admin',
    });
    await expect(createBooking(input())).rejects.toThrow('Phòng có lịch bảo trì trong khoảng thời gian này.');
  });
});

describe('createBooking – quyền và đặt lặp tuần', () => {
  test('admin and unknown accounts cannot create bookings', async () => {
    await expect(createBooking(input({ requesterUsername: 'admin' })))
      .rejects.toThrow('Tài khoản không hoạt động hoặc không có quyền thực hiện thao tác này.');
    await expect(createBooking(input({ requesterUsername: 'ghost' })))
      .rejects.toThrow('Tài khoản không hoạt động hoặc không có quyền thực hiện thao tác này.');
  });

  test.each([0, -1, 1.5])('rejects repeatWeeks=%s', async repeatWeeks => {
    await expect(createBooking(input({ repeatWeekly: true, repeatWeeks })))
      .rejects.toThrow('Số tuần lặp lại phải là số nguyên dương.');
  });

  test('caps a weekly series at 8 occurrences', async () => {
    await createBooking(input({ repeatWeekly: true, repeatWeeks: 20 }));
    const series = await getBookings();
    expect(series).toHaveLength(8);
    expect(series.map(item => item.recurringWeekIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test('weekly dates cross the year boundary correctly', async () => {
    freezeTime(new Date(2030, 11, 29, 8, 0));
    await createBooking(input({ date: '2030-12-30', repeatWeekly: true, repeatWeeks: 3 }));
    const dates = (await getBookings()).map(item => item.date);
    expect(dates).toEqual(['2030-12-30', '2031-01-06', '2031-01-13']);
  });

  test('a series is rejected atomically if one later week conflicts', async () => {
    await registerAccount({ username: 'lecturer2', password: 'pass' });
    await seedBookings([
      makeBooking({ requesterUsername: 'lecturer2', status: 'APPROVED', date: dayOffset(15) }),
    ]);
    await expect(createBooking(input({ date: dayOffset(1), repeatWeekly: true, repeatWeeks: 3 })))
      .rejects.toThrow('Phòng đã có yêu cầu khác trong khoảng thời gian này.');
    expect(await getBookings()).toHaveLength(1);
  });

  test('a non-recurring booking has no series id', async () => {
    const booking = await createBooking(input({ repeatWeekly: false, repeatWeeks: 4 }));
    expect(booking.recurringSeriesId).toBeUndefined();
    expect(booking.repeatWeeks).toBe(1);
    expect(await getBookings()).toHaveLength(1);
  });

  test('notifies the admin about a new request', async () => {
    await createBooking(input());
    const titles = (await getNotifications('admin')).map(item => item.title);
    expect(titles).toContain('Có yêu cầu đặt phòng mới');
  });
});

describe('truy vấn và phân loại booking', () => {
  test('getBookingsForUser filters by owner and sorts newest slot first', async () => {
    await seedBookings([
      makeBooking({ id: 'a', date: '2030-01-11', startTime: '09:00' }),
      makeBooking({ id: 'b', date: '2030-01-12', startTime: '08:00' }),
      makeBooking({ id: 'c', date: '2030-01-11', startTime: '13:00' }),
      makeBooking({ id: 'd', requesterUsername: 'someone-else' }),
    ]);
    expect((await getBookingsForUser('user')).map(item => item.id)).toEqual(['b', 'c', 'a']);
  });

  test('getRoomOccupancy only exposes active bookings and hides personal data', async () => {
    await seedBookings([
      makeBooking({ id: 'p', status: 'PENDING' }),
      makeBooking({ id: 'a', status: 'APPROVED', startTime: '11:00', endTime: '12:00' }),
      makeBooking({ id: 'c', status: 'CANCELLED' }),
    ]);
    const occupancy = await getRoomOccupancy();
    expect(occupancy).toHaveLength(2);
    occupancy.forEach(item => {
      expect(Object.keys(item).sort()).toEqual(['date', 'endTime', 'roomId', 'startTime', 'status']);
    });
  });

  test('getBookingTimeCategory', () => {
    const now = new Date(2030, 0, 10, 12, 0);
    const past = { date: '2030-01-10', startTime: '09:00', endTime: '10:00' };
    const future = { date: '2030-01-11', startTime: '09:00', endTime: '10:00' };
    expect(getBookingTimeCategory(makeBooking({ ...past, status: 'APPROVED' }), now)).toBe('USED');
    expect(getBookingTimeCategory(makeBooking({ ...past, status: 'PENDING' }), now)).toBe('CANCELLED');
    expect(getBookingTimeCategory(makeBooking({ ...future, status: 'PENDING' }), now)).toBe('UPCOMING');
    expect(getBookingTimeCategory(makeBooking({ ...future, status: 'REJECTED' }), now)).toBe('CANCELLED');
    expect(getBookingTimeCategory(makeBooking({ ...future, status: 'NO_SHOW' }), now)).toBe('CANCELLED');
  });

  test('isBookingStillActive ignores inactive statuses', () => {
    const booking = makeBooking({ date: '2030-01-11' });
    expect(isBookingStillActive({ ...booking, status: 'CANCELLED' }, FIXED_NOW)).toBe(false);
    expect(isBookingStillActive({ ...booking, status: 'APPROVED' }, FIXED_NOW)).toBe(true);
  });

  test('toLocalDateTime builds a local Date', () => {
    const value = toLocalDateTime('2030-03-05', '14:30');
    expect([value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes()])
      .toEqual([2030, 2, 5, 14, 30]);
  });
});

describe('meetsReplacementRoomRequirements', () => {
  const base = DEMO_ROOMS.find(room => room.id === 'room-a101')!;

  test('accepts an equal or better room with the same lock and equipment', () => {
    expect(meetsReplacementRoomRequirements(base, { ...base, id: 'other', capacity: 40, equipment: [' máy chiếu ', 'ĐIỀU HÒA', 'TV'] })).toBe(true);
  });

  test.each([
    ['same room', { id: base.id }],
    ['maintenance', { id: 'x', status: 'MAINTENANCE' as const }],
    ['different lock', { id: 'x', lockType: 'PHYSICAL_KEY' as const }],
    ['smaller capacity', { id: 'x', capacity: base.capacity - 1 }],
    ['missing equipment', { id: 'x', equipment: ['Máy chiếu'] }],
  ])('rejects %s', (_label, changes) => {
    expect(meetsReplacementRoomRequirements(base, { ...base, ...changes })).toBe(false);
  });
});
