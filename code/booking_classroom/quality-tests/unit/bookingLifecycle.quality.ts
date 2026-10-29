/* eslint-env jest */
import {
  acceptKeyPickupProposal,
  cancelBooking,
  changeBookingRoom,
  confirmBookingCheckIn,
  confirmBookingNoShow,
  getBookingById,
  proposeKeyPickup,
  recordSmartLockAccessEvent,
  reportRoomObservation,
  reviewBooking,
  reviewRecurringSeries,
  scheduleKeyPickup,
  setPickupDelegate,
  updateBooking,
  updatePendingRecurringBookings,
  cancelFutureRecurringBookings,
} from '../../src/modules/booking';
import { hasRoomPinPermission } from '../../src/modules/access_control';
import { registerAccount } from '../../src/modules/auth';
import { createMaintenance } from '../../src/modules/schedule_maintenance';
import { getNotifications } from '../../src/modules/notifications';
import { getMaintenanceRequests } from '../../src/modules/schedule_maintenance';
import {
  FIXED_NOW,
  freezeTime,
  makeBooking,
  resetStorage,
  seedBookings,
  seedConfiguration,
} from '../support/testUtils';

// FIXED_NOW = 2030-01-10 08:00 giờ địa phương.
const TODAY = '2030-01-10';
const TOMORROW = '2030-01-11';
const PIN_ROOM = 'room-a101'; // PIN, 30 chỗ, Máy chiếu + Điều hòa
const PIN_ROOM_TWIN = 'room-floor-2-1'; // giống hệt room-a101
const KEY_ROOM = 'room-floor-1-3'; // PHYSICAL_KEY, 60 chỗ, Máy chiếu + Micro
const KEY_ROOM_SMALL = 'room-floor-1-6'; // PHYSICAL_KEY, 40 chỗ

beforeEach(async () => {
  await resetStorage();
  freezeTime();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('room observations', () => {
  test('sends a minor room note to admin without creating maintenance', async () => {
    await seedConfiguration({ notificationsEnabled: false });
    await seedBookings([makeBooking({ id: 'b1', date: TODAY, startTime: '07:00', endTime: '09:00', status: 'APPROVED' })]);
    await reportRoomObservation('b1', 'user', ' Thiếu bút viết bảng ');
    expect(await getMaintenanceRequests()).toHaveLength(0);
    expect((await getNotifications('admin'))[0]).toMatchObject({
      title: 'Có ghi chú về phòng',
      tone: 'attention',
      message: expect.stringContaining('Thiếu bút viết bảng'),
    });
  });

  test('requires content, owner and an approved booking in its usage window', async () => {
    await seedBookings([makeBooking({ id: 'b1', date: TODAY, startTime: '07:00', endTime: '09:00', status: 'APPROVED' })]);
    await expect(reportRoomObservation('b1', 'user', ' ')).rejects.toThrow('Vui lòng nhập nội dung ghi chú.');
    await expect(reportRoomObservation('b1', 'admin', 'Thiếu bút')).rejects.toThrow('Tài khoản không hoạt động hoặc không có quyền thực hiện thao tác này.');
    await registerAccount({ username: 'another', password: 'abcd' });
    await expect(reportRoomObservation('b1', 'another', 'Thiếu bút')).rejects.toThrow('Bạn không có quyền ghi chú cho lượt đặt phòng này.');
    await expect(reportRoomObservation('b1', 'user', 'Thiếu bút', new Date(2030, 0, 10, 10)))
      .rejects.toThrow('Chỉ gửi ghi chú khi bạn đang sử dụng phòng đã được duyệt.');
  });
});

describe('reviewBooking', () => {
  test('only an admin can review', async () => {
    await seedBookings([makeBooking({ id: 'b1' })]);
    await expect(reviewBooking('b1', 'APPROVED', 'user')).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });

  test('rejects unknown and already reviewed bookings', async () => {
    await seedBookings([makeBooking({ id: 'b1', status: 'APPROVED' })]);
    await expect(reviewBooking('missing', 'APPROVED', 'admin')).rejects.toThrow('Không tìm thấy yêu cầu đặt phòng.');
    await expect(reviewBooking('b1', 'REJECTED', 'admin')).rejects.toThrow('Yêu cầu này đã được xử lý.');
  });

  test('cannot approve a session that already ended, but can still reject it', async () => {
    await seedBookings([makeBooking({ id: 'old', date: TODAY, startTime: '06:00', endTime: '07:00' })]);
    await expect(reviewBooking('old', 'APPROVED', 'admin')).rejects.toThrow('Không thể duyệt yêu cầu đã hết giờ sử dụng.');
    await expect(reviewBooking('old', 'REJECTED', 'admin')).resolves.toMatchObject({ status: 'REJECTED' });
  });

  test('cannot approve over maintenance or an approved overlap', async () => {
    await seedBookings([
      makeBooking({ id: 'approved', status: 'APPROVED', requesterUsername: 'other' }),
      makeBooking({ id: 'pending' }),
      makeBooking({ id: 'maint', roomId: PIN_ROOM_TWIN }),
    ]);
    await createMaintenance({ roomId: PIN_ROOM_TWIN, date: TOMORROW, startTime: '09:00', endTime: '09:30', reason: 'Điện', createdBy: 'admin' });

    await expect(reviewBooking('pending', 'APPROVED', 'admin')).rejects.toThrow('Phòng đã có yêu cầu được duyệt trùng thời gian.');
    await expect(reviewBooking('maint', 'APPROVED', 'admin')).rejects.toThrow('Phòng đã có lịch bảo trì trong khung giờ này.');
  });

  test('approving a PIN room grants room permission; a key room does not', async () => {
    await seedBookings([
      makeBooking({ id: 'pin' }),
      makeBooking({ id: 'key', roomId: KEY_ROOM, startTime: '13:00', endTime: '14:00' }),
    ]);
    const approved = await reviewBooking('pin', 'APPROVED', 'admin');
    await reviewBooking('key', 'APPROVED', 'admin');

    expect(approved).toMatchObject({ status: 'APPROVED', reviewedBy: 'admin' });
    expect(approved.reviewedAt).toBe(FIXED_NOW.toISOString());
    expect(await hasRoomPinPermission('user', PIN_ROOM)).toBe(true);
    expect(await hasRoomPinPermission('user', KEY_ROOM)).toBe(false);
    expect((await getNotifications('user')).map(item => item.title)).toContain('Yêu cầu đã được duyệt');
  });

  test('rejection notifies the requester', async () => {
    await seedBookings([makeBooking({ id: 'b1' })]);
    await reviewBooking('b1', 'REJECTED', 'admin');
    expect((await getNotifications('user'))[0].title).toBe('Yêu cầu bị từ chối');
  });
});

describe('reviewRecurringSeries', () => {
  test('errors when no pending occurrence remains', async () => {
    await seedBookings([makeBooking({ recurringSeriesId: 's1', status: 'APPROVED' })]);
    await expect(reviewRecurringSeries('s1', 'APPROVED', 'admin')).rejects.toThrow('Chuỗi này không còn yêu cầu chờ duyệt.');
  });

  test('refuses the whole series if one occurrence has already ended', async () => {
    await seedBookings([
      makeBooking({ id: 'w0', recurringSeriesId: 's1', date: TODAY, startTime: '06:00', endTime: '07:00' }),
      makeBooking({ id: 'w1', recurringSeriesId: 's1', date: '2030-01-17' }),
    ]);
    await expect(reviewRecurringSeries('s1', 'APPROVED', 'admin'))
      .rejects.toThrow('Có lượt trong chuỗi đã hết giờ sử dụng; chưa lượt nào được duyệt.');
    expect((await getBookingById('w1'))?.status).toBe('PENDING');
  });

  test('refuses the whole series on a maintenance conflict', async () => {
    await seedBookings([
      makeBooking({ id: 'w0', recurringSeriesId: 's1', date: TOMORROW }),
      makeBooking({ id: 'w1', recurringSeriesId: 's1', date: '2030-01-18' }),
    ]);
    await createMaintenance({ roomId: PIN_ROOM, date: '2030-01-18', startTime: '09:00', endTime: '12:00', reason: 'Sơn', createdBy: 'admin' });
    await expect(reviewRecurringSeries('s1', 'APPROVED', 'admin'))
      .rejects.toThrow('Có lượt trong chuỗi trùng lịch bảo trì; chưa lượt nào được duyệt.');
  });
});

describe('cancelBooking', () => {
  test('only the owner can cancel and only active bookings', async () => {
    await registerAccount({ username: 'other', password: 'pass' });
    await seedBookings([
      makeBooking({ id: 'mine' }),
      makeBooking({ id: 'done', status: 'REJECTED' }),
    ]);
    await expect(cancelBooking('mine', 'other')).rejects.toThrow('Bạn không có quyền hủy yêu cầu này.');
    await expect(cancelBooking('done', 'user')).rejects.toThrow('Yêu cầu này không thể hủy.');
    await expect(cancelBooking('missing', 'user')).rejects.toThrow('Không tìm thấy yêu cầu đặt phòng.');
  });

  test('cannot cancel after the session started', async () => {
    await seedBookings([makeBooking({ id: 'now', date: TODAY, startTime: '07:30', endTime: '09:00' })]);
    await expect(cancelBooking('now', 'user')).rejects.toThrow('Không thể hủy sau khi phiên sử dụng đã bắt đầu.');
  });

  test('approved bookings respect the cancellation cutoff, pending ones do not', async () => {
    await seedBookings([
      makeBooking({ id: 'approved', status: 'APPROVED', date: TODAY, startTime: '08:20', endTime: '09:00' }),
      makeBooking({ id: 'pending', status: 'PENDING', date: TODAY, startTime: '08:10', endTime: '08:50', roomId: PIN_ROOM_TWIN }),
    ]);
    await expect(cancelBooking('approved', 'user')).rejects.toThrow('Yêu cầu đã duyệt chỉ được hủy trước ít nhất 30 phút.');
    await expect(cancelBooking('pending', 'user')).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  test('exactly at the cutoff the approved booking can be cancelled', async () => {
    await seedBookings([makeBooking({ id: 'edge', status: 'APPROVED', date: TODAY, startTime: '08:30', endTime: '09:30' })]);
    await expect(cancelBooking('edge', 'user')).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  test('cancelling revokes an issued PIN', async () => {
    await seedBookings([makeBooking({
      id: 'pin',
      status: 'APPROVED',
      temporaryPin: { code: '1234567', createdAt: '', createdBy: 'user', validFrom: '', validUntil: '' },
    })]);
    const cancelled = await cancelBooking('pin', 'user');
    expect(cancelled.temporaryPin?.revokedAt).toBe(FIXED_NOW.toISOString());
  });
});

describe('chuỗi đặt lặp – sửa và hủy', () => {
  test('cannot edit someone else\'s series or a missing series', async () => {
    await registerAccount({ username: 'other', password: 'pass' });
    await seedBookings([makeBooking({ id: 'single' }), makeBooking({ id: 's', recurringSeriesId: 's1' })]);
    const changes = { startTime: '13:00', endTime: '14:00', purpose: 'X' };
    await expect(updatePendingRecurringBookings('single', 'user', changes)).rejects.toThrow('Không tìm thấy chuỗi đặt lặp lại.');
    await expect(updatePendingRecurringBookings('s', 'other', changes)).rejects.toThrow('Bạn không có quyền sửa chuỗi đặt này.');
    await expect(cancelFutureRecurringBookings('s', 'other')).rejects.toThrow('Bạn không có quyền hủy chuỗi đặt này.');
  });

  test('only future pending occurrences are edited', async () => {
    await seedBookings([
      makeBooking({ id: 'past', recurringSeriesId: 's1', date: '2030-01-03', status: 'APPROVED' }),
      makeBooking({ id: 'approved', recurringSeriesId: 's1', date: TOMORROW, status: 'APPROVED' }),
      makeBooking({ id: 'pending', recurringSeriesId: 's1', date: '2030-01-18' }),
    ]);
    const count = await updatePendingRecurringBookings('pending', 'user', { startTime: '13:00', endTime: '14:00', purpose: ' Mới ' });
    expect(count).toBe(1);
    expect(await getBookingById('pending')).toMatchObject({ startTime: '13:00', endTime: '14:00', purpose: 'Mới' });
    expect(await getBookingById('approved')).toMatchObject({ startTime: '09:00' });
  });

  test('cancelling a series is all-or-nothing on the approved cutoff', async () => {
    await seedBookings([
      makeBooking({ id: 'soon', recurringSeriesId: 's1', status: 'APPROVED', date: TODAY, startTime: '08:15', endTime: '09:00' }),
      makeBooking({ id: 'later', recurringSeriesId: 's1', date: '2030-01-17' }),
    ]);
    await expect(cancelFutureRecurringBookings('later', 'user'))
      .rejects.toThrow('Có lượt đã duyệt không đủ hạn hủy trước 30 phút; chưa lượt nào bị hủy.');
    expect((await getBookingById('later'))?.status).toBe('PENDING');
  });
});

describe('changeBookingRoom', () => {
  beforeEach(async () => {
    await seedBookings([
      makeBooking({ id: 'b1', status: 'APPROVED', userCanGeneratePin: true,
        temporaryPin: { code: '7654321', createdAt: '', createdBy: 'user', validFrom: '', validUntil: '' } }),
      makeBooking({ id: 'big', roomId: 'room-floor-1-7', status: 'APPROVED', startTime: '13:00', endTime: '14:00' }),
      makeBooking({ id: 'pending', status: 'PENDING', date: '2030-01-12' }),
    ]);
  });

  test.each([
    ['pending', PIN_ROOM_TWIN, 'lý do', 'Chỉ đổi phòng cho yêu cầu đã duyệt.'],
    ['b1', PIN_ROOM, 'lý do', 'Hãy chọn một phòng khác.'],
    ['b1', PIN_ROOM_TWIN, '  ', 'Vui lòng nhập lý do đổi phòng.'],
    ['b1', 'missing-room', 'lý do', 'Phòng thay thế không khả dụng.'],
    ['b1', KEY_ROOM, 'lý do', 'Phòng thay thế phải có cùng loại khóa với phòng hiện tại.'],
    ['big', PIN_ROOM, 'lý do', 'Phòng thay thế phải có sức chứa bằng hoặc lớn hơn phòng hiện tại.'],
    ['b1', 'room-floor-1-5', 'lý do', 'Phòng thay thế phải có đầy đủ thiết bị của phòng hiện tại.'],
  ])('booking %s → %s is rejected', async (id, roomId, reason, message) => {
    await expect(changeBookingRoom(id, roomId, 'admin', reason)).rejects.toThrow(message);
  });

  test('respects the room change cutoff', async () => {
    await seedConfiguration({ roomChangeCutoffMinutes: 25 * 60 + 1 });
    await expect(changeBookingRoom('b1', PIN_ROOM_TWIN, 'admin', 'Hỏng điều hòa'))
      .rejects.toThrow('Chỉ được đổi phòng trước giờ bắt đầu ít nhất 1501 phút.');
  });

  test('refuses a replacement that already has an active request at that time', async () => {
    await updateBooking('pending', current => ({ ...current, roomId: PIN_ROOM_TWIN, date: TOMORROW }));
    await expect(changeBookingRoom('b1', PIN_ROOM_TWIN, 'admin', 'Hỏng điều hòa'))
      .rejects.toThrow('Phòng thay thế đã có yêu cầu chờ hoặc yêu cầu được duyệt trùng thời gian.');
  });

  test('moves the booking, revokes the old PIN and grants permission for the new PIN room', async () => {
    const result = await changeBookingRoom('b1', PIN_ROOM_TWIN, 'admin', ' Hỏng điều hòa ');
    expect(result.roomId).toBe(PIN_ROOM_TWIN);
    expect(result.temporaryPin?.revokedAt).toBeDefined();
    expect(result.roomChanges).toEqual([expect.objectContaining({
      fromRoomId: PIN_ROOM, toRoomId: PIN_ROOM_TWIN, changedBy: 'admin', reason: 'Hỏng điều hòa',
    })]);
    expect(await hasRoomPinPermission('user', PIN_ROOM_TWIN)).toBe(true);
    expect((await getBookingById('b1'))?.userCanGeneratePin).toBe(true);
    expect((await getNotifications('user'))[0].title).toBe('Đặt phòng đã được đổi phòng');
  });
});

describe('khóa cơ – ủy quyền và lịch nhận khóa', () => {
  beforeEach(async () => {
    await seedBookings([
      makeBooking({ id: 'key', roomId: KEY_ROOM, status: 'APPROVED' }),
      makeBooking({ id: 'pin', roomId: PIN_ROOM, status: 'APPROVED', startTime: '13:00', endTime: '14:00' }),
    ]);
  });

  test('setPickupDelegate validations', async () => {
    await expect(setPickupDelegate('pin', 'user', 'A', '1')).rejects.toThrow('Ủy quyền nhận hộ chỉ áp dụng cho khóa cơ/thẻ.');
    await expect(setPickupDelegate('key', 'user', ' ', '1')).rejects.toThrow('Cần nhập họ tên và mã sinh viên người nhận hộ.');
    const updated = await setPickupDelegate('key', 'user', ' Nguyễn Văn A ', ' 2021001 ');
    expect(updated.pickupDelegate).toMatchObject({ fullName: 'Nguyễn Văn A', studentId: '2021001' });
  });

  test('scheduleKeyPickup must be in the future and before the session', async () => {
    await expect(scheduleKeyPickup('key', 'admin', TODAY, '07:00', 'P.101')).rejects.toThrow('Lịch nhận khóa phải ở tương lai và trước giờ sử dụng phòng.');
    await expect(scheduleKeyPickup('key', 'admin', TOMORROW, '09:00', 'P.101')).rejects.toThrow('Lịch nhận khóa phải ở tương lai và trước giờ sử dụng phòng.');
    await expect(scheduleKeyPickup('key', 'admin', TOMORROW, '08:00', ' ')).rejects.toThrow('Vui lòng nhập địa điểm nhận khóa.');
    await expect(scheduleKeyPickup('pin', 'admin', TOMORROW, '08:00', 'P.101')).rejects.toThrow('Phòng này không dùng khóa cơ/thẻ.');
    const result = await scheduleKeyPickup('key', 'admin', TOMORROW, '08:00', ' Phòng hành chính ');
    expect(result.keyPickupNegotiation?.status).toBe('AGREED');
    expect(result.keyPickupAppointment?.location).toBe('Phòng hành chính');
  });

  test('negotiation turn order is enforced', async () => {
    await expect(proposeKeyPickup('key', 'admin', 'admin', TOMORROW, '08:00', 'P.101'))
      .rejects.toThrow('Cần có đề xuất thời gian từ người dùng trước.');

    await proposeKeyPickup('key', 'user', 'user', TOMORROW, '08:00');
    await expect(proposeKeyPickup('key', 'user', 'user', TOMORROW, '08:15'))
      .rejects.toThrow('Đang chờ quản trị viên phản hồi thời gian bạn đã gửi.');
    await expect(acceptKeyPickupProposal('key', 'user', 'user'))
      .rejects.toThrow('Bên còn lại phải xác nhận đề xuất này.');
    await expect(acceptKeyPickupProposal('key', 'admin', 'admin'))
      .rejects.toThrow('Vui lòng nhập địa điểm nhận khóa trước khi duyệt.');

    await expect(proposeKeyPickup('key', 'admin', 'admin', TOMORROW, '08:30', ' '))
      .rejects.toThrow('Quản trị viên cần nhập địa điểm nhận khóa.');
    const counter = await proposeKeyPickup('key', 'admin', 'admin', TOMORROW, '08:30', 'Tầng 1');
    expect(counter.keyPickupNegotiation?.status).toBe('WAITING_USER');
    expect(counter.keyPickupNegotiation?.history).toHaveLength(2);

    const agreed = await acceptKeyPickupProposal('key', 'user', 'user');
    expect(agreed.keyPickupAppointment).toMatchObject({ time: '08:30', location: 'Tầng 1', agreedBy: 'user' });
    await expect(proposeKeyPickup('key', 'user', 'user', TOMORROW, '08:40'))
      .rejects.toThrow('Hai bên đã thống nhất lịch nhận khóa.');
  });
});

describe('check-in thủ công và vắng mặt', () => {
  const during = new Date(2030, 0, 11, 9, 20);

  beforeEach(async () => {
    await seedBookings([
      makeBooking({ id: 'key', roomId: KEY_ROOM, status: 'APPROVED' }),
      makeBooking({ id: 'pin', roomId: PIN_ROOM, status: 'APPROVED' }),
      makeBooking({ id: 'key2', roomId: KEY_ROOM_SMALL, status: 'APPROVED',
        temporaryPin: { code: '1111111', createdAt: '', createdBy: '', validFrom: '', validUntil: '' } }),
    ]);
  });

  test('manual check-in only for key rooms and only during the session', async () => {
    await expect(confirmBookingCheckIn('pin', 'admin', during)).rejects.toThrow('Check-in thủ công chỉ áp dụng cho phòng khóa cơ/thẻ.');
    await expect(confirmBookingCheckIn('key', 'admin', new Date(2030, 0, 11, 8, 59))).rejects.toThrow('Chỉ xác nhận có mặt trong thời gian sử dụng phòng.');
    await expect(confirmBookingCheckIn('key', 'admin', new Date(2030, 0, 11, 10, 0))).rejects.toThrow('Chỉ xác nhận có mặt trong thời gian sử dụng phòng.');
    const checkedIn = await confirmBookingCheckIn('key', 'admin', during);
    expect(checkedIn).toMatchObject({ checkedInAt: during.toISOString(), checkInConfirmedBy: 'admin' });
    await expect(confirmBookingCheckIn('key', 'admin', during)).rejects.toThrow('Booking này đã có check-in được ghi nhận.');
  });

  test('no-show is allowed exactly at the grace boundary and revokes the PIN', async () => {
    await expect(confirmBookingNoShow('key2', 'admin', new Date(2030, 0, 11, 9, 14, 59)))
      .rejects.toThrow('Chỉ xác nhận vắng mặt sau 15 phút kể từ giờ bắt đầu.');
    const noShow = await confirmBookingNoShow('key2', 'admin', new Date(2030, 0, 11, 9, 15));
    expect(noShow.status).toBe('NO_SHOW');
    expect(noShow.temporaryPin?.revokedAt).toBe(noShow.noShowAt);
    await expect(confirmBookingNoShow('key2', 'admin', during)).rejects.toThrow('Chỉ xác nhận vắng mặt cho booking đã duyệt.');
  });

  test('a SmartLock check-in event prevents no-show', async () => {
    await updateBooking('pin', current => ({ ...current, smartLockAccessEvents: [{ type: 'CHECK_IN', occurredAt: during.toISOString(), trait: 'traitUnlockTempPwd' }] }));
    await expect(confirmBookingNoShow('pin', 'admin', new Date(2030, 0, 11, 9, 30)))
      .rejects.toThrow('Booking đã có check-in, không thể ghi nhận vắng mặt.');
  });

  test('non-admins cannot confirm attendance', async () => {
    await expect(confirmBookingCheckIn('key', 'user', during)).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
    await expect(confirmBookingNoShow('key', 'user', during)).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });
});

describe('recordSmartLockAccessEvent', () => {
  const event = (type: 'CHECK_IN' | 'CHECK_OUT', at: Date) => ({ type, occurredAt: at.toISOString(), trait: 'test' });

  beforeEach(async () => {
    await seedBookings([makeBooking({ id: 'pin', roomId: PIN_ROOM, status: 'APPROVED' })]);
  });

  test('ignores invalid timestamps and events outside the grace window', async () => {
    expect(await recordSmartLockAccessEvent(PIN_ROOM, { type: 'CHECK_IN', occurredAt: 'not-a-date', trait: 't' })).toBeUndefined();
    expect(await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_IN', new Date(2030, 0, 11, 8, 49)))).toBeUndefined();
    expect(await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_IN', new Date(2030, 0, 11, 10, 11)))).toBeUndefined();
  });

  test('accepts a check-in within the grace window before the start', async () => {
    const result = await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_IN', new Date(2030, 0, 11, 8, 50)));
    expect(result?.checkedInAt).toBeDefined();
  });

  test('check-out requires a prior check-in and duplicates are not appended', async () => {
    expect(await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_OUT', new Date(2030, 0, 11, 9, 50)))).toBeUndefined();
    await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_IN', new Date(2030, 0, 11, 9, 0)));
    await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_IN', new Date(2030, 0, 11, 9, 5)));
    const out = await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_OUT', new Date(2030, 0, 11, 9, 55)));
    expect(out?.checkedOutAt).toBeDefined();
    expect(out?.smartLockAccessEvents?.map(item => item.type)).toEqual(['CHECK_IN', 'CHECK_OUT']);
  });

  test('pending bookings are never matched', async () => {
    await seedBookings([makeBooking({ id: 'p', roomId: PIN_ROOM, status: 'PENDING' })]);
    expect(await recordSmartLockAccessEvent(PIN_ROOM, event('CHECK_IN', new Date(2030, 0, 11, 9, 0)))).toBeUndefined();
  });
});
