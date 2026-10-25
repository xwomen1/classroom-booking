/* eslint-env jest */
/**
 * Kiểm thử tích hợp nhiều module ở chế độ local: đi qua đúng các service mà
 * màn hình gọi, từ lúc giảng viên đặt phòng tới lúc SmartLock ghi nhận ra vào.
 * Chỉ tầng OneIoT (native MQTT) được giả lập.
 */
import {
  createTemporaryPin,
  deliverPendingTemporaryPins,
  hasRoomPinPermission,
  revokeRoomPinPermission,
} from '../../src/modules/access_control';
import {
  acceptKeyPickupProposal,
  cancelBooking,
  changeBookingRoom,
  confirmBookingCheckIn,
  confirmBookingNoShow,
  createBooking,
  getBookingById,
  getBookings,
  proposeKeyPickup,
  reviewBooking,
} from '../../src/modules/booking';
import { authenticate, registerAccount } from '../../src/modules/auth';
import { saveConfiguration } from '../../src/modules/configuration';
import { getNotifications, getUnreadCount } from '../../src/modules/notifications';
import {
  assignSmartLockToRoom,
  getManagedSmartLock,
  handleOneIoTSmartLockMessage,
} from '../../src/modules/smart_lock';
import * as oneIoTClient from '../../src/modules/smart_lock/services/oneIoTClient';
import {
  createMaintenance,
  getMaintenanceRequests,
  requestRoomMaintenance,
  scheduleMaintenanceFromRequest,
} from '../../src/modules/schedule_maintenance';
import { freezeTime, resetStorage } from '../support/testUtils';

// FIXED_NOW = Thứ Năm 2030-01-10 08:00 (giờ địa phương).
const TOMORROW = '2030-01-11';
const PIN_ROOM = 'room-a101';
const PIN_ROOM_TWIN = 'room-floor-2-1';
const KEY_ROOM = 'room-floor-1-3';

function lockMessage(trait: string, at: Date, deviceID?: string) {
  return {
    topic: '/oneM2M/req/smartlock',
    receivedAt: at.toISOString(),
    payload: JSON.stringify({
      pc: { 'm2m:cin': { con: JSON.stringify({ dataMessage: { properties: { data: {
        trait, deviceID, timeStamp: Math.floor(at.getTime() / 1000),
      } } } }) } },
    }),
  };
}

function goOnline() {
  jest.spyOn(oneIoTClient, 'getOneIoTConnectionStatus').mockResolvedValue({ connected: true });
  return jest.spyOn(oneIoTClient, 'sendTemporaryPasswordToOneIoT').mockImplementation(async (_lock, command) => ({
    accepted: true,
    trait: 'traitCreateTmpPasswordLock',
    requestId: `req-${command.passwordId}`,
    passwordId: command.passwordId,
    publishedAt: new Date().toISOString(),
  }));
}

beforeEach(async () => {
  await resetStorage();
  freezeTime();
  await registerAccount({ username: 'gv.an', password: 'abcd', recoveryCode: '1234' });
  await assignSmartLockToRoom(PIN_ROOM, 'admin');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('phòng khóa số: đặt → duyệt → tạo PIN offline → kết nối → gửi khóa → check-in → check-out', async () => {
  // 1. Giảng viên đăng nhập và đặt phòng.
  expect(await authenticate('gv.an', 'abcd')).toEqual({ username: 'gv.an', role: 'user' });
  const booking = await createBooking({
    requesterUsername: 'gv.an', roomId: PIN_ROOM, date: TOMORROW, startTime: '09:00', endTime: '11:00', purpose: 'Seminar',
  });
  expect((await getNotifications('admin'))[0].title).toBe('Có yêu cầu đặt phòng mới');

  // 2. Admin duyệt → giảng viên có quyền tự tạo mã cho đúng phòng này.
  await reviewBooking(booking.id, 'APPROVED', 'admin');
  expect(await hasRoomPinPermission('gv.an', PIN_ROOM)).toBe(true);

  // 3. Tạo PIN khi chưa kết nối OneIoT: mã có ngay trong app, lệnh chờ gửi.
  const offline = await createTemporaryPin(booking.id, 'gv.an', 'user');
  expect(offline.temporaryPin?.code).toMatch(/^\d{7}$/);
  expect(offline.temporaryPin?.lockDeliveredAt).toBeUndefined();
  expect((await getNotifications('gv.an'))[0].message).toContain('lệnh sẽ được gửi khi kết nối OneIoT');

  // 4. Kết nối OneIoT → app gửi các mã đang chờ.
  const send = goOnline();
  expect(await deliverPendingTemporaryPins()).toEqual({ sent: 1, failed: 0, skipped: 0 });
  const lock = await getManagedSmartLock();
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ assignedRoomId: PIN_ROOM }), expect.objectContaining({
    roomId: PIN_ROOM,
    code: offline.temporaryPin!.code,
    passwordId: offline.temporaryPin!.lockPasswordId,
    startTime: Math.floor(new Date(2030, 0, 11, 8, 50).getTime() / 1000),
    endTime: Math.floor(new Date(2030, 0, 11, 11, 10).getTime() / 1000),
  }));
  const delivered = await getBookingById(booking.id);
  expect(delivered?.temporaryPin).toMatchObject({ lockCommandId: `req-${offline.temporaryPin!.lockPasswordId}` });
  expect(delivered?.temporaryPin?.lockDeliveredAt).toBeDefined();

  // 5. Lần gửi tiếp theo không gửi lại mã đã gửi.
  expect(await deliverPendingTemporaryPins()).toEqual({ sent: 0, failed: 0, skipped: 0 });

  // 6. SmartLock báo mở cửa bằng mã tạm → check-in; khóa cửa → check-out.
  await handleOneIoTSmartLockMessage(lockMessage('traitUnlockTempPwd', new Date(2030, 0, 11, 8, 55), lock.smartLockDeviceId));
  await handleOneIoTSmartLockMessage(lockMessage('traitLocked', new Date(2030, 0, 11, 10, 58), lock.smartLockDeviceId));
  const finished = await getBookingById(booking.id);
  expect(finished?.checkedInAt).toBe(new Date(2030, 0, 11, 8, 55).toISOString());
  expect(finished?.checkedOutAt).toBe(new Date(2030, 0, 11, 10, 58).toISOString());
  expect((await getNotifications('admin')).map(item => item.title)).toEqual(
    expect.arrayContaining(['SmartLock: check in', 'SmartLock: check out']),
  );

  // 7. Đã check-in thì không thể đánh dấu vắng mặt.
  await expect(confirmBookingNoShow(booking.id, 'admin', new Date(2030, 0, 11, 9, 30)))
    .rejects.toThrow('Booking đã có check-in, không thể ghi nhận vắng mặt.');
});

test('gửi PIN thất bại được ghi lại và gửi lại thành công ở lần kết nối sau', async () => {
  const booking = await createBooking({
    requesterUsername: 'gv.an', roomId: PIN_ROOM, date: TOMORROW, startTime: '09:00', endTime: '10:00', purpose: 'Họp',
  });
  await reviewBooking(booking.id, 'APPROVED', 'admin');
  await createTemporaryPin(booking.id, 'admin', 'admin');

  jest.spyOn(oneIoTClient, 'getOneIoTConnectionStatus').mockResolvedValue({ connected: true });
  jest.spyOn(oneIoTClient, 'sendTemporaryPasswordToOneIoT').mockRejectedValueOnce(new Error('MQTT timeout'));
  expect(await deliverPendingTemporaryPins()).toEqual({ sent: 0, failed: 1, skipped: 0 });
  expect((await getBookingById(booking.id))?.temporaryPin?.lockDeliveryError).toBe('MQTT timeout');

  jest.restoreAllMocks();
  goOnline();
  expect(await deliverPendingTemporaryPins()).toEqual({ sent: 1, failed: 0, skipped: 0 });
  const pin = (await getBookingById(booking.id))?.temporaryPin;
  expect(pin?.lockDeliveryError).toBeUndefined();
  expect(pin?.lockDeliveredAt).toBeDefined();
});

test('không gửi PIN đã thu hồi, đã hết hạn hoặc khi chưa kết nối', async () => {
  await expect(deliverPendingTemporaryPins()).rejects.toThrow('Phiên OneIoT chưa kết nối.');

  const first = await createBooking({ requesterUsername: 'gv.an', roomId: PIN_ROOM, date: TOMORROW, startTime: '09:00', endTime: '10:00', purpose: 'A' });
  await reviewBooking(first.id, 'APPROVED', 'admin');
  await createTemporaryPin(first.id, 'admin', 'admin');
  await cancelBooking(first.id, 'gv.an');

  const second = await createBooking({ requesterUsername: 'gv.an', roomId: PIN_ROOM, date: TOMORROW, startTime: '13:00', endTime: '14:00', purpose: 'B' });
  await reviewBooking(second.id, 'APPROVED', 'admin');
  await createTemporaryPin(second.id, 'admin', 'admin');

  const send = goOnline();
  // Sau khi phiên thứ hai kết thúc (+10 phút đệm) mã đã hết hạn.
  expect(await deliverPendingTemporaryPins(new Date(2030, 0, 11, 14, 11))).toEqual({ sent: 0, failed: 0, skipped: 1 });
  expect(send).not.toHaveBeenCalled();
});

test('thu hồi quyền phòng chặn giảng viên tự tạo mã', async () => {
  const booking = await createBooking({ requesterUsername: 'gv.an', roomId: PIN_ROOM, date: TOMORROW, startTime: '09:00', endTime: '10:00', purpose: 'A' });
  await reviewBooking(booking.id, 'APPROVED', 'admin');
  await revokeRoomPinPermission('gv.an', PIN_ROOM, 'admin');
  await expect(createTemporaryPin(booking.id, 'gv.an', 'user'))
    .rejects.toThrow('Quyền tự tạo mã tại phòng này đã bị thu hồi hoặc chưa được cấp.');
  expect((await getNotifications('gv.an'))[0].title).toBe('Đã thu hồi quyền tự tạo mã');
});

test('đổi phòng khẩn cấp: PIN cũ bị thu hồi, SmartLock không mở cho phòng mới', async () => {
  const booking = await createBooking({ requesterUsername: 'gv.an', roomId: PIN_ROOM, date: TOMORROW, startTime: '09:00', endTime: '10:00', purpose: 'A' });
  await reviewBooking(booking.id, 'APPROVED', 'admin');
  await createTemporaryPin(booking.id, 'gv.an', 'user');

  const moved = await changeBookingRoom(booking.id, PIN_ROOM_TWIN, 'admin', 'Mất điện tầng 1');
  expect(moved.temporaryPin?.revokedAt).toBeDefined();
  expect(await hasRoomPinPermission('gv.an', PIN_ROOM_TWIN)).toBe(true);

  // SmartLock duy nhất vẫn gắn ở phòng cũ → không thể cấp mã cho phòng mới.
  await expect(createTemporaryPin(booking.id, 'gv.an', 'user'))
    .rejects.toThrow('Phòng chưa được gắn với SmartLock đang quản lý.');

  // Sự kiện mở khóa ở phòng cũ không còn khớp với booking đã chuyển đi.
  await handleOneIoTSmartLockMessage(lockMessage('traitUnlockTempPwd', new Date(2030, 0, 11, 9, 0)));
  expect((await getBookingById(booking.id))?.checkedInAt).toBeUndefined();
});

test('phòng khóa cơ: thương lượng nhận khóa → admin xác nhận có mặt', async () => {
  const booking = await createBooking({ requesterUsername: 'gv.an', roomId: KEY_ROOM, date: TOMORROW, startTime: '09:00', endTime: '10:00', purpose: 'Thi' });
  await reviewBooking(booking.id, 'APPROVED', 'admin');
  expect(await hasRoomPinPermission('gv.an', KEY_ROOM)).toBe(false);

  await proposeKeyPickup(booking.id, 'gv.an', 'user', TOMORROW, '08:00');
  await proposeKeyPickup(booking.id, 'admin', 'admin', TOMORROW, '08:30', 'Phòng bảo vệ');
  const agreed = await acceptKeyPickupProposal(booking.id, 'gv.an', 'user');
  expect(agreed.keyPickupAppointment).toMatchObject({ date: TOMORROW, time: '08:30', location: 'Phòng bảo vệ' });
  expect((await getNotifications('admin'))[0].title).toBe('Đã thống nhất lịch nhận khóa');

  const checkedIn = await confirmBookingCheckIn(booking.id, 'admin', new Date(2030, 0, 11, 9, 5));
  expect(checkedIn.checkInConfirmedBy).toBe('admin');
  await expect(confirmBookingNoShow(booking.id, 'admin', new Date(2030, 0, 11, 9, 30)))
    .rejects.toThrow('Booking đã có check-in, không thể ghi nhận vắng mặt.');
});

test('vắng mặt giải phóng khung giờ cho người khác', async () => {
  const booking = await createBooking({ requesterUsername: 'gv.an', roomId: KEY_ROOM, date: TOMORROW, startTime: '09:00', endTime: '11:00', purpose: 'A' });
  await reviewBooking(booking.id, 'APPROVED', 'admin');
  await confirmBookingNoShow(booking.id, 'admin', new Date(2030, 0, 11, 9, 15));

  freezeTime(new Date(2030, 0, 11, 9, 16));
  await saveConfiguration({
    minAdvanceDays: 0, maxAdvanceDays: 3, maxActiveBookingsPerUser: 2, cancellationCutoffMinutes: 30,
    roomChangeCutoffMinutes: 30, pinGraceMinutes: 10, noShowGraceMinutes: 15, notificationsEnabled: true,
  }, 'admin');
  const replacement = await createBooking({ requesterUsername: 'user', roomId: KEY_ROOM, date: TOMORROW, startTime: '09:30', endTime: '11:00', purpose: 'Dùng thay' });
  expect(replacement.status).toBe('PENDING');
  await expect(reviewBooking(replacement.id, 'APPROVED', 'admin')).resolves.toMatchObject({ status: 'APPROVED' });
  expect((await getNotifications('gv.an'))[0].title).toBe('Đã ghi nhận vắng mặt');
});

test('báo sự cố khi đang dùng phòng → admin lên lịch bảo trì → phòng bị chặn đặt', async () => {
  const booking = await createBooking({ requesterUsername: 'gv.an', roomId: PIN_ROOM, date: TOMORROW, startTime: '09:00', endTime: '10:00', purpose: 'A' });
  await reviewBooking(booking.id, 'APPROVED', 'admin');

  const request = await requestRoomMaintenance(booking.id, 'gv.an', 'Máy chiếu hỏng', new Date(2030, 0, 11, 9, 20));
  expect(await getUnreadCount('admin')).toBeGreaterThanOrEqual(2);

  await scheduleMaintenanceFromRequest(request.id, {
    roomId: PIN_ROOM, date: '2030-01-12', startTime: '07:00', endTime: '12:00', reason: 'Thay máy chiếu', createdBy: 'admin',
  });
  expect((await getMaintenanceRequests())[0].status).toBe('SCHEDULED');
  expect((await getNotifications('gv.an'))[0].title).toBe('Yêu cầu bảo trì đã được tiếp nhận');

  await expect(createBooking({ requesterUsername: 'user', roomId: PIN_ROOM, date: '2030-01-12', startTime: '09:00', endTime: '10:00', purpose: 'B' }))
    .rejects.toThrow('Phòng có lịch bảo trì trong khoảng thời gian này.');
  await expect(createMaintenance({ roomId: PIN_ROOM, date: TOMORROW, startTime: '09:30', endTime: '09:45', reason: 'X', createdBy: 'admin' }))
    .rejects.toThrow('Phòng có yêu cầu đã duyệt trùng thời gian; cần đổi phòng trước khi lên lịch bảo trì.');
  expect(await getBookings()).toHaveLength(1);
});
