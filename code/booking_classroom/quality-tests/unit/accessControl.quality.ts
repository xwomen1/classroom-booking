/* eslint-env jest */
import {
  createTemporaryPin,
  getPinDisplayStatus,
  getRoomPinPermissions,
  grantRoomPinPermission,
  grantUserPinPermission,
  hasRoomPinPermission,
  revokeRoomPinPermission,
} from '../../src/modules/access_control';
import { getBookingById } from '../../src/modules/booking';
import { assignSmartLockToRoom, getManagedSmartLock } from '../../src/modules/smart_lock';
import { registerAccount } from '../../src/modules/auth';
import { writeJson } from '../../src/core/storage/jsonStorage';
import {
  freezeTime,
  makeBooking,
  resetStorage,
  seedBookings,
  seedConfiguration,
} from '../support/testUtils';

const PIN_ROOM = 'room-a101';
const KEY_ROOM = 'room-floor-1-3';

beforeEach(async () => {
  await resetStorage();
  freezeTime();
  await assignSmartLockToRoom(PIN_ROOM, 'admin');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('roomPinPermissionRepository', () => {
  test('only PIN rooms can be granted', async () => {
    await expect(grantRoomPinPermission('user', KEY_ROOM, 'admin'))
      .rejects.toThrow('Chỉ cấp quyền tự tạo mã cho phòng dùng khóa mã số.');
    await expect(grantRoomPinPermission('user', PIN_ROOM, 'user'))
      .rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });

  test('re-granting reuses the permission record', async () => {
    const first = await grantRoomPinPermission('user', PIN_ROOM, 'admin');
    await revokeRoomPinPermission('user', PIN_ROOM, 'admin');
    expect(await hasRoomPinPermission('user', PIN_ROOM)).toBe(false);
    const second = await grantRoomPinPermission('user', PIN_ROOM, 'admin');
    expect(second.id).toBe(first.id);
    expect(await getRoomPinPermissions()).toHaveLength(1);
    expect(await hasRoomPinPermission('user', PIN_ROOM)).toBe(true);
  });

  test('permissions are scoped to user and room', async () => {
    await grantRoomPinPermission('user', PIN_ROOM, 'admin');
    expect(await hasRoomPinPermission('user', 'room-floor-1-2')).toBe(false);
    expect(await hasRoomPinPermission('someone', PIN_ROOM)).toBe(false);
  });

  test('revoking a non-active permission fails', async () => {
    await expect(revokeRoomPinPermission('user', PIN_ROOM, 'admin'))
      .rejects.toThrow('Người dùng không có quyền đang hoạt động tại phòng này.');
  });

  test('grantUserPinPermission marks the booking', async () => {
    await seedBookings([makeBooking({ id: 'b', status: 'APPROVED' }), makeBooking({ id: 'p' })]);
    await expect(grantUserPinPermission('p', 'admin')).rejects.toThrow('Chỉ cấp quyền cho yêu cầu đã được duyệt.');
    expect((await grantUserPinPermission('b', 'admin')).userCanGeneratePin).toBe(true);
  });
});

describe('createTemporaryPin', () => {
  beforeEach(async () => {
    await registerAccount({ username: 'other', password: 'pass' });
    await seedBookings([
      makeBooking({ id: 'approved', status: 'APPROVED' }),
      makeBooking({ id: 'pending', status: 'PENDING', startTime: '11:00', endTime: '12:00' }),
      makeBooking({ id: 'key', status: 'APPROVED', roomId: KEY_ROOM }),
      makeBooking({ id: 'ended', status: 'APPROVED', date: '2030-01-10', startTime: '06:00', endTime: '07:00' }),
      makeBooking({ id: 'other-room', status: 'APPROVED', roomId: 'room-floor-1-2' }),
    ]);
  });

  test.each([
    ['missing', 'admin', 'admin', 'Không tìm thấy yêu cầu đặt phòng.'],
    ['pending', 'admin', 'admin', 'Chỉ tạo mã cho yêu cầu đã được duyệt.'],
    ['key', 'admin', 'admin', 'Phòng này không sử dụng khóa mã số.'],
    ['approved', 'other', 'user', 'Bạn không có quyền tạo mã cho yêu cầu của người khác.'],
    ['approved', 'user', 'user', 'Quyền tự tạo mã tại phòng này đã bị thu hồi hoặc chưa được cấp.'],
    ['ended', 'admin', 'admin', 'Không thể tạo mã cho phiên sử dụng đã kết thúc.'],
    ['other-room', 'admin', 'admin', 'Phòng chưa được gắn với SmartLock đang quản lý.'],
  ] as const)('booking %s by %s (%s) is rejected', async (id, actor, role, message) => {
    await expect(createTemporaryPin(id, actor, role)).rejects.toThrow(message);
  });

  test('creates a 7-digit PIN valid from start−grace to end+grace', async () => {
    await seedConfiguration({ pinGraceMinutes: 5 });
    const updated = await createTemporaryPin('approved', 'admin', 'admin');
    const pin = updated.temporaryPin!;
    expect(pin.code).toMatch(/^[1-9]\d{6}$/);
    expect(new Date(pin.validFrom)).toEqual(new Date(2030, 0, 11, 8, 55));
    expect(new Date(pin.validUntil)).toEqual(new Date(2030, 0, 11, 10, 5));
    expect(pin.lockPasswordId).toBe(1);
    expect(pin.lockDeliveredAt).toBeUndefined();
  });

  test('a booking cannot hold two live PINs', async () => {
    await createTemporaryPin('approved', 'admin', 'admin');
    await expect(createTemporaryPin('approved', 'admin', 'admin')).rejects.toThrow('Yêu cầu đặt phòng đã có mã tạm thời.');
  });

  test('a user with room permission can create their own PIN', async () => {
    await grantRoomPinPermission('user', PIN_ROOM, 'admin');
    const updated = await createTemporaryPin('approved', 'user', 'user');
    expect(updated.temporaryPin?.createdBy).toBe('user');
    expect((await getBookingById('approved'))?.temporaryPin?.code).toBe(updated.temporaryPin?.code);
  });

  test('password ids increase per PIN and wrap from 255 back to 1', async () => {
    const lock = await getManagedSmartLock();
    await writeJson('smartLock.primary', { ...lock, nextPasswordId: 255 });
    await seedBookings([
      makeBooking({ id: 'a', status: 'APPROVED' }),
      makeBooking({ id: 'b', status: 'APPROVED', startTime: '11:00', endTime: '12:00' }),
    ]);
    expect((await createTemporaryPin('a', 'admin', 'admin')).temporaryPin?.lockPasswordId).toBe(255);
    expect((await createTemporaryPin('b', 'admin', 'admin')).temporaryPin?.lockPasswordId).toBe(1);
  });
});

describe('getPinDisplayStatus', () => {
  const pin = {
    code: '1234567', createdAt: '', createdBy: 'admin',
    validFrom: new Date(2030, 0, 11, 8, 50).toISOString(),
    validUntil: new Date(2030, 0, 11, 10, 10).toISOString(),
  };

  test('maps time and revocation to a status', () => {
    const booking = makeBooking({ status: 'APPROVED', temporaryPin: pin });
    expect(getPinDisplayStatus(makeBooking())).toBeNull();
    expect(getPinDisplayStatus(booking, new Date(2030, 0, 11, 8, 49))).toBe('PENDING');
    expect(getPinDisplayStatus(booking, new Date(2030, 0, 11, 8, 50))).toBe('ACTIVE');
    expect(getPinDisplayStatus(booking, new Date(2030, 0, 11, 10, 10))).toBe('ACTIVE');
    expect(getPinDisplayStatus(booking, new Date(2030, 0, 11, 10, 11))).toBe('EXPIRED');
    expect(getPinDisplayStatus({ ...booking, temporaryPin: { ...pin, revokedAt: 'x' } })).toBe('REVOKED');
    expect(getPinDisplayStatus({ ...booking, status: 'CANCELLED' })).toBe('REVOKED');
    expect(getPinDisplayStatus({ ...booking, status: 'NO_SHOW' })).toBe('REVOKED');
  });
});
