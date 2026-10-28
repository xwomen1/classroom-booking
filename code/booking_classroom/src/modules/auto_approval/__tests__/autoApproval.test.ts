import { storage } from '../../../core/storage/jsonStorage';
import { grantRoomPinPermission, hasRoomPinPermission } from '../../access_control';
import { registerAccount } from '../../auth';
import { createBooking, getBookings, reviewBooking } from '../../booking';
import { DEFAULT_CONFIGURATION, getConfiguration, saveConfiguration } from '../../configuration';
import { getNotifications } from '../../notifications';
import { createRoom, getRoomById, updateRoom } from '../../room_management';
import { AUTO_APPROVER, getApprovalMode } from '..';

// Thứ Năm 2030-01-10 08:00 giờ máy; mặc định chỉ đặt trước 1–3 ngày.
const NOW = new Date(2030, 0, 10, 8, 0);
const TOMORROW = '2030-01-11';
const PIN_ROOM = 'room-a101';
const KEY_ROOM = 'room-floor-1-3';

function request(overrides: Partial<Parameters<typeof createBooking>[0]> = {}) {
  return {
    requesterUsername: 'user',
    roomId: PIN_ROOM,
    date: TOMORROW,
    startTime: '09:00',
    endTime: '10:00',
    purpose: 'Seminar',
    ...overrides,
  };
}

async function enableAutoApproval() {
  await saveConfiguration({ ...DEFAULT_CONFIGURATION, autoApprovalEnabled: true }, 'admin');
}

async function markSpecial(roomId: string) {
  const room = (await getRoomById(roomId))!;
  await updateRoom(roomId, { ...room, requiresApproval: true }, 'admin');
}

beforeEach(async () => {
  await storage.clear();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getApprovalMode', () => {
  test('the global switch off keeps every room on manual review', () => {
    expect(getApprovalMode({}, { autoApprovalEnabled: false })).toBe('MANUAL');
    expect(getApprovalMode({ requiresApproval: true }, { autoApprovalEnabled: false })).toBe('MANUAL');
  });

  test('with the switch on, only special rooms need manual review', () => {
    expect(getApprovalMode({}, { autoApprovalEnabled: true })).toBe('AUTO');
    expect(getApprovalMode({ requiresApproval: false }, { autoApprovalEnabled: true })).toBe('AUTO');
    expect(getApprovalMode({ requiresApproval: true }, { autoApprovalEnabled: true })).toBe('MANUAL');
  });
});

describe('cấu hình và dữ liệu phòng', () => {
  test('auto approval is off by default and can be saved', async () => {
    expect((await getConfiguration()).autoApprovalEnabled).toBe(false);
    await enableAutoApproval();
    expect((await getConfiguration()).autoApprovalEnabled).toBe(true);
  });

  test('rooms are normal unless marked special', async () => {
    const room = await createRoom({
      name: 'X901', floor: 8, location: '', capacity: 20, equipment: [], lockType: 'PIN_CODE', status: 'AVAILABLE',
    }, 'admin');
    expect(room.requiresApproval).toBe(false);
    await markSpecial(room.id);
    expect((await getRoomById(room.id))?.requiresApproval).toBe(true);
  });
});

describe('createBooking với module tự động duyệt', () => {
  test('switch off: the old flow is unchanged', async () => {
    const booking = await createBooking(request());
    expect(booking).toMatchObject({ status: 'PENDING' });
    expect(booking.autoApproved).toBeUndefined();
    expect((await getNotifications('admin'))[0].title).toBe('Có yêu cầu đặt phòng mới');
    expect(await hasRoomPinPermission('user', PIN_ROOM)).toBe(false);
  });

  test('normal PIN room is approved by the system immediately', async () => {
    await enableAutoApproval();
    const booking = await createBooking(request());

    expect(booking).toMatchObject({
      status: 'APPROVED',
      autoApproved: true,
      reviewedBy: AUTO_APPROVER,
      reviewedAt: NOW.toISOString(),
    });
    expect((await getBookings())[0].status).toBe('APPROVED');
    expect(await hasRoomPinPermission('user', PIN_ROOM)).toBe(true);
    expect((await getNotifications('user'))[0].title).toBe('Yêu cầu đã được tự động duyệt');
    expect((await getNotifications('admin'))[0].title).toBe('Đặt phòng được tự động duyệt');
  });

  test('normal key room is approved without granting a PIN permission', async () => {
    await enableAutoApproval();
    await expect(createBooking(request({ roomId: KEY_ROOM }))).resolves.toMatchObject({ status: 'APPROVED' });
    expect(await hasRoomPinPermission('user', KEY_ROOM)).toBe(false);
  });

  test('special room stays pending and the admin reviews it as before', async () => {
    await enableAutoApproval();
    await markSpecial(PIN_ROOM);

    const booking = await createBooking(request());
    expect(booking.status).toBe('PENDING');
    expect((await getNotifications('admin'))[0].title).toBe('Có yêu cầu đặt phòng mới');

    const reviewed = await reviewBooking(booking.id, 'APPROVED', 'admin');
    expect(reviewed).toMatchObject({ status: 'APPROVED', reviewedBy: 'admin' });
    expect(reviewed.autoApproved).toBeUndefined();
  });

  test('every week of a recurring series is approved together', async () => {
    await enableAutoApproval();
    await createBooking(request({ repeatWeekly: true, repeatWeeks: 3 }));
    const series = await getBookings();
    expect(series).toHaveLength(3);
    expect(series.every(item => item.status === 'APPROVED' && item.autoApproved)).toBe(true);
    expect((await getNotifications('user'))[0].message).toContain('và 2 lịch lặp lại');
  });

  test('booking rules still apply: an auto-approved slot blocks other requests', async () => {
    await enableAutoApproval();
    await registerAccount({ username: 'gv2', password: 'abcd', recoveryCode: '1234' });
    await createBooking(request());
    await expect(createBooking(request({ requesterUsername: 'gv2', startTime: '09:30', endTime: '10:30' })))
      .rejects.toThrow('Phòng đã có yêu cầu khác trong khoảng thời gian này.');
    expect(await getBookings()).toHaveLength(1);
  });

  test('admins still need their role to grant PIN permissions by hand', async () => {
    await expect(grantRoomPinPermission('user', PIN_ROOM, 'user'))
      .rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });
});
