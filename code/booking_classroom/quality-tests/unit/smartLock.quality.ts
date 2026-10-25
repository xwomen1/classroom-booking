/* eslint-env jest */
import {
  assignSmartLockToRoom,
  getManagedSmartLock,
  getSmartLockForRoom,
  handleOneIoTSmartLockMessage,
  parseSmartLockAccessEvent,
  reserveSmartLockPasswordId,
  unassignSmartLock,
} from '../../src/modules/smart_lock';
import { getBookingById } from '../../src/modules/booking';
import { readJson, writeJson } from '../../src/core/storage/jsonStorage';
import { makeBooking, resetStorage, seedBookings } from '../support/testUtils';

const RECEIVED_AT = '2030-01-11T02:00:00.000Z';

beforeEach(async () => {
  await resetStorage();
});

describe('smartLockRepository', () => {
  test('creates the default lock on first read', async () => {
    const lock = await getManagedSmartLock();
    expect(lock).toMatchObject({ id: 'primary-smart-lock', model: 'DLWA12', nextPasswordId: 1 });
    expect(lock.assignedRoomId).toBeUndefined();
    expect(await readJson('smartLock.primary', null)).not.toBeNull();
  });

  test('migrates legacy field names and ids', async () => {
    await writeJson('smartLock.primary', {
      aeId: 'S0a92253e-6f4b-472e-86a8-e25a3853cd11',
      deviceId: 'custom-device',
      deviceName: 'SMARTLOCK_device_55132471',
      nextPasswordId: 0,
      assignedRoomId: 'room-a101',
    });
    const lock = await getManagedSmartLock();
    expect(lock.smartLockAeId).toBe('Sdd6f3763-b655-43ad-87d0-3862be2a1201');
    expect(lock.smartLockDeviceId).toBe('custom-device');
    expect(lock.smartLockDeviceName).toBe('smartlock_0001');
    expect(lock.nextPasswordId).toBe(1);
    expect(lock.assignedRoomId).toBe('room-a101');
    expect(await readJson('smartLock.primary', null)).toEqual(lock);
  });

  test('can only be assigned by an admin to an existing PIN room', async () => {
    await expect(assignSmartLockToRoom('room-a101', 'user')).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
    await expect(assignSmartLockToRoom('missing', 'admin')).rejects.toThrow('Không tìm thấy phòng được chọn.');
    await expect(assignSmartLockToRoom('room-floor-1-3', 'admin')).rejects.toThrow('Chỉ được gắn SmartLock vào phòng sử dụng khóa mã số.');
    const lock = await assignSmartLockToRoom('room-a101', 'admin');
    expect(lock).toMatchObject({ assignedRoomId: 'room-a101', assignedBy: 'admin' });
    expect(await getSmartLockForRoom('room-a101')).toBeDefined();
    expect(await getSmartLockForRoom('room-floor-1-2')).toBeUndefined();
  });

  test('unassign removes every assignment field', async () => {
    await assignSmartLockToRoom('room-a101', 'admin');
    const lock = await unassignSmartLock('admin');
    expect(lock).not.toHaveProperty('assignedRoomId');
    expect(lock).not.toHaveProperty('assignedAt');
    expect(lock).not.toHaveProperty('assignedBy');
    await expect(reserveSmartLockPasswordId('room-a101')).rejects.toThrow('Phòng chưa được gắn với SmartLock đang quản lý.');
  });

  test('reserveSmartLockPasswordId increments and wraps', async () => {
    await assignSmartLockToRoom('room-a101', 'admin');
    expect((await reserveSmartLockPasswordId('room-a101')).passwordId).toBe(1);
    expect((await reserveSmartLockPasswordId('room-a101')).passwordId).toBe(2);
    const lock = await getManagedSmartLock();
    await writeJson('smartLock.primary', { ...lock, nextPasswordId: 255 });
    expect((await reserveSmartLockPasswordId('room-a101')).passwordId).toBe(255);
    expect((await getManagedSmartLock()).nextPasswordId).toBe(1);
  });
});

describe('parseSmartLockAccessEvent', () => {
  const wrapCin = (inner: unknown) => JSON.stringify({ pc: { 'm2m:cin': { con: JSON.stringify(inner) } } });
  const wrapSignal = (inner: unknown) => JSON.stringify({
    pc: { 'm2m:sgn': { nev: { rep: { 'm2m:cin': { con: JSON.stringify(inner) } } } } },
  });
  const traitMessage = (data: Record<string, unknown>) => ({ dataMessage: { properties: { data } } });

  test.each([
    'traitUnlockMCU', 'traitUnlockApp', 'traitUnlockPassword', 'traitUnlockTempPwd',
    'traitUnlockFinger', 'traitUnlockCard', 'traitUnlockInside', 'traitCheckIn',
  ])('%s is a check-in', trait => {
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait })), RECEIVED_AT)?.type).toBe('CHECK_IN');
  });

  test.each([
    'traitLockMCU', 'traitLockApp', 'traitResponseLockStatus', 'traitDoorClosed', 'traitLocked', 'traitCheckOut',
  ])('%s is a check-out', trait => {
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait })), RECEIVED_AT)?.type).toBe('CHECK_OUT');
  });

  test('traitResponseUnlockStatus counts only when value is 0', () => {
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait: 'traitResponseUnlockStatus', value: 0 })))?.type).toBe('CHECK_IN');
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait: 'traitResponseUnlockStatus', value: '0' })))?.type).toBe('CHECK_IN');
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait: 'traitResponseUnlockStatus', value: 1 })))).toBeUndefined();
  });

  test('unwraps oneM2M notification envelopes', () => {
    const event = parseSmartLockAccessEvent(wrapSignal(traitMessage({ trait: 'traitUnlockCard', deviceID: 'lock-1' })), RECEIVED_AT);
    expect(event).toEqual({ type: 'CHECK_IN', trait: 'traitUnlockCard', occurredAt: RECEIVED_AT, deviceId: 'lock-1' });
  });

  test('unwraps data that is double-encoded as JSON strings', () => {
    const payload = JSON.stringify({ data: JSON.stringify({ data: JSON.stringify(traitMessage({ trait: 'traitLocked' })) }) });
    expect(parseSmartLockAccessEvent(payload, RECEIVED_AT)?.type).toBe('CHECK_OUT');
  });

  test.each(['checkin', 'CHECK_IN', 'check-in'])('direct event "%s" is a check-in', value => {
    expect(parseSmartLockAccessEvent(JSON.stringify({ event: value }), RECEIVED_AT)).toMatchObject({ type: 'CHECK_IN', trait: value.toLowerCase() });
  });

  test('normalizes second and millisecond timestamps and ISO strings', () => {
    const seconds = 1_893_456_000; // 2030-01-01T00:00:00Z
    const iso = new Date(seconds * 1000).toISOString();
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait: 'traitCheckIn', timeStamp: seconds })))?.occurredAt).toBe(iso);
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait: 'traitCheckIn', timestamp: String(seconds * 1000) })))?.occurredAt).toBe(iso);
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait: 'traitCheckIn', timeStamp: iso })))?.occurredAt).toBe(iso);
    expect(parseSmartLockAccessEvent(wrapCin(traitMessage({ trait: 'traitCheckIn', timeStamp: 'garbage' })), RECEIVED_AT)?.occurredAt).toBe(RECEIVED_AT);
  });

  test.each([
    ['not json', 'hello'],
    ['array', '[1,2]'],
    ['unknown trait', JSON.stringify(traitMessage({ trait: 'traitBatteryLow' }))],
    ['no trait', JSON.stringify({ foo: 1 })],
    ['null', 'null'],
  ])('returns undefined for %s', (_label, payload) => {
    expect(parseSmartLockAccessEvent(payload, RECEIVED_AT)).toBeUndefined();
  });
});

describe('handleOneIoTSmartLockMessage', () => {
  const message = (data: Record<string, unknown>) => ({
    topic: '/oneM2M/req/test',
    receivedAt: new Date(2030, 0, 11, 9, 5).toISOString(),
    payload: JSON.stringify({ dataMessage: { properties: { data } } }),
  });

  beforeEach(async () => {
    await seedBookings([makeBooking({ id: 'b', status: 'APPROVED', roomId: 'room-a101' })]);
  });

  test('does nothing while the lock is not assigned', async () => {
    await handleOneIoTSmartLockMessage(message({ trait: 'traitUnlockTempPwd' }));
    expect((await getBookingById('b'))?.checkedInAt).toBeUndefined();
  });

  test('ignores telemetry from another device', async () => {
    await assignSmartLockToRoom('room-a101', 'admin');
    await handleOneIoTSmartLockMessage(message({ trait: 'traitUnlockTempPwd', deviceID: 'someone-else' }));
    expect((await getBookingById('b'))?.checkedInAt).toBeUndefined();
  });

  test('records a check-in from the managed device with its topic', async () => {
    const lock = await assignSmartLockToRoom('room-a101', 'admin');
    await handleOneIoTSmartLockMessage(message({ trait: 'traitUnlockTempPwd', deviceID: lock.smartLockDeviceId }));
    const booking = await getBookingById('b');
    expect(booking?.checkedInAt).toBeDefined();
    expect(booking?.smartLockAccessEvents?.[0]).toMatchObject({ topic: '/oneM2M/req/test', trait: 'traitUnlockTempPwd' });
  });
});
