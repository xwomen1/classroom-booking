/// <reference types="node" />
/* eslint-env jest */
/**
 * Kiểm thử hợp đồng app ↔ booking-server khi bật ENABLE_REMOTE_SYNC.
 *
 * Mỗi hàm service được gọi ở chế độ remote với `fetch` giả lập. Mọi request
 * app gửi ra (method + path) được đối chiếu với các @XxxMapping khai báo trong
 * ApiController.java, để phát hiện sớm việc hai phía lệch endpoint.
 */
import fs from 'fs';
import path from 'path';
import { clearApiSession } from '../../src/core/api/client';
import * as auth from '../../src/modules/auth/services/accountRepository';
import * as bookings from '../../src/modules/booking/services/bookingRepository';
import * as rooms from '../../src/modules/room_management/services/roomRepository';
import * as configuration from '../../src/modules/configuration/services/configurationRepository';
import * as maintenance from '../../src/modules/schedule_maintenance/services/maintenanceRepository';
import * as notifications from '../../src/modules/notifications/services/notificationRepository';
import * as permissions from '../../src/modules/access_control/services/roomPinPermissionRepository';
import * as smartLock from '../../src/modules/smart_lock/services/smartLockRepository';
import * as profile from '../../src/modules/profile/services/profileRepository';
import { DEFAULT_CONFIGURATION } from '../../src/modules/configuration/model/appConfiguration';

type RecordedRequest = { method: string; path: string; body?: unknown; headers: Record<string, string> };

const CONTROLLER = path.resolve(
  __dirname,
  '../../../booking-server/src/main/java/com/bookingclassroom/server/ApiController.java',
);

type Route = { method: string; template: string; pattern: RegExp };

function serverRoutes(): Route[] {
  const source = fs.readFileSync(CONTROLLER, 'utf8');
  const prefix = source.match(/@RequestMapping\("([^"]+)"\)/)?.[1] ?? '';
  return [...source.matchAll(/@(Get|Post|Put|Delete|Patch)Mapping\("([^"]+)"\)/g)].map(match => {
    const template = `${prefix}${match[2]}`;
    const pattern = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    return { method: match[1].toUpperCase(), template, pattern };
  });
}

const SERIES_ID = 'series 1/a';
const REMOTE_BOOKING = { id: 'b1', recurringSeriesId: SERIES_ID, requesterUsername: 'user', status: 'APPROVED' };

/** Server giả: trả về dữ liệu tối thiểu mà từng service cần để chạy tiếp. */
function fakeServer(requests: RecordedRequest[]) {
  return jest.fn(async (url: string, init: RequestInit) => {
    const { pathname } = new URL(url);
    const method = init.method ?? 'GET';
    requests.push({
      method,
      path: pathname,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: init.headers as Record<string, string>,
    });

    let status = 200;
    let body: unknown = { booking: REMOTE_BOOKING, count: 1 };
    if (pathname === '/api/auth/login') {
      const credentials = JSON.parse(String(init.body));
      if (credentials.password === 'wrong') {
        status = 401;
        body = { message: 'Sai tài khoản hoặc mật khẩu.' };
      } else {
        body = { token: 'session-token', username: credentials.username, role: 'user' };
      }
    } else if (pathname === '/api/auth/register') {
      body = { token: 'register-token', username: 'new', role: 'user' };
    } else if (method === 'GET' && ['/api/bookings', '/api/rooms', '/api/notifications', '/api/pin-permissions',
      '/api/accounts', '/api/maintenance', '/api/maintenance/requests', '/api/room-occupancy'].includes(pathname)) {
      body = pathname === '/api/bookings' ? [REMOTE_BOOKING] : [];
    } else if (method === 'DELETE') {
      status = 204;
    }
    return {
      ok: status < 400,
      status,
      text: async () => (status === 204 ? '' : JSON.stringify(body)),
    } as Response;
  });
}

const originalNodeEnv = process.env.NODE_ENV;
const originalFetch = globalThis.fetch;
let requests: RecordedRequest[];

beforeEach(() => {
  requests = [];
  clearApiSession();
  globalThis.fetch = fakeServer(requests) as unknown as typeof fetch;
  // isRemoteApiEnabled() = ENABLE_REMOTE_SYNC && NODE_ENV !== 'test'
  process.env.NODE_ENV = 'production';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  globalThis.fetch = originalFetch;
  clearApiSession();
});

const ROOM_INPUT = {
  name: '101', floor: 1, location: 'Tầng 1', capacity: 30, equipment: ['TV'],
  lockType: 'PIN_CODE' as const, status: 'AVAILABLE' as const,
};
const MAINTENANCE_INPUT = {
  roomId: 'room-a101', date: '2030-01-11', startTime: '09:00', endTime: '10:00', reason: 'x', createdBy: 'admin',
};
const PIN = { code: '1234567', createdAt: '', createdBy: 'user', validFrom: '', validUntil: '' };

/** Mọi lời gọi service có nhánh remote. */
const SERVICE_CALLS: Array<[string, () => Promise<unknown>]> = [
  ['authenticate', () => auth.authenticate('user', '2')],
  ['registerAccount', () => auth.registerAccount({ username: 'new', password: 'abcd' })],
  ['getAccounts', () => auth.getAccounts()],
  ['createManagedAccount', () => auth.createManagedAccount({ username: 'gv', password: 'abcd', recoveryCode: 'abcd', role: 'user' }, 'admin')],
  ['updateManagedAccount', () => auth.updateManagedAccount('gv 01', { active: false }, 'admin')],
  ['deleteManagedAccount', () => auth.deleteManagedAccount('gv 01', 'admin')],
  ['resetPassword', () => auth.resetPasswordWithRecoveryCode('user', '222222', 'abcd')],
  ['changePassword', () => auth.changePassword('user', '2', 'abcd')],
  ['getProfile', () => profile.getProfile('user')],
  ['saveProfile', () => profile.saveProfile({ username: 'user', fullName: 'A', email: '', phone: '', department: '' })],
  ['getRooms', () => rooms.getRooms()],
  ['createRoom', () => rooms.createRoom(ROOM_INPUT, 'admin')],
  ['updateRoom', () => rooms.updateRoom('room-a101', ROOM_INPUT, 'admin')],
  ['deleteRoom', () => rooms.deleteRoom('room-a101', 'admin')],
  ['getConfiguration', () => configuration.getConfiguration()],
  ['saveConfiguration', () => configuration.saveConfiguration(DEFAULT_CONFIGURATION, 'admin')],
  ['getMaintenanceRecords', () => maintenance.getMaintenanceRecords()],
  ['getMaintenanceRequests', () => maintenance.getMaintenanceRequests()],
  ['createMaintenance', () => maintenance.createMaintenance(MAINTENANCE_INPUT)],
  ['cancelMaintenance', () => maintenance.cancelMaintenance('m1', 'admin')],
  ['requestRoomMaintenance', () => maintenance.requestRoomMaintenance('b1', 'user', 'x')],
  ['scheduleMaintenanceFromRequest', () => maintenance.scheduleMaintenanceFromRequest('r1', MAINTENANCE_INPUT)],
  ['rejectMaintenanceRequest', () => maintenance.rejectMaintenanceRequest('r1', 'admin', 'note')],
  ['getBookings', () => bookings.getBookings()],
  ['getRoomOccupancy', () => bookings.getRoomOccupancy()],
  ['createBooking', () => bookings.createBooking({ requesterUsername: 'user', roomId: 'room-a101', date: '2030-01-11', startTime: '09:00', endTime: '10:00', purpose: 'x' })],
  ['reportRoomObservation', () => bookings.reportRoomObservation('b1', 'user', 'Thiếu bút viết bảng')],
  ['reviewBooking', () => bookings.reviewBooking('b1', 'APPROVED', 'admin')],
  ['reviewRecurringSeries', () => bookings.reviewRecurringSeries(SERIES_ID, 'REJECTED', 'admin')],
  ['updatePendingRecurringBookings', () => bookings.updatePendingRecurringBookings('b1', 'user', { startTime: '10:00', endTime: '11:00', purpose: 'x' })],
  ['cancelFutureRecurringBookings', () => bookings.cancelFutureRecurringBookings('b1', 'user')],
  ['saveTemporaryPin', () => bookings.saveTemporaryPin('b1', PIN)],
  ['cancelBooking', () => bookings.cancelBooking('b1', 'user')],
  ['changeBookingRoom', () => bookings.changeBookingRoom('b1', 'room-b202', 'admin', 'x')],
  ['setPickupDelegate', () => bookings.setPickupDelegate('b1', 'user', 'A', '1')],
  ['proposeKeyPickup', () => bookings.proposeKeyPickup('b1', 'user', 'user', '2030-01-11', '08:00')],
  ['scheduleKeyPickup', () => bookings.scheduleKeyPickup('b1', 'admin', '2030-01-11', '08:00', 'P1')],
  ['acceptKeyPickupProposal', () => bookings.acceptKeyPickupProposal('b1', 'admin', 'admin', 'P1')],
  ['recordSmartLockAccessEvent', () => bookings.recordSmartLockAccessEvent('room-a101', { type: 'CHECK_IN', occurredAt: '', trait: 't' })],
  ['confirmBookingCheckIn', () => bookings.confirmBookingCheckIn('b1', 'admin')],
  ['confirmBookingNoShow', () => bookings.confirmBookingNoShow('b1', 'admin')],
  ['getRoomPinPermissions', () => permissions.getRoomPinPermissions()],
  ['grantRoomPinPermission', () => permissions.grantRoomPinPermission('user', 'room-a101', 'admin')],
  ['revokeRoomPinPermission', () => permissions.revokeRoomPinPermission('user', 'room-a101', 'admin')],
  ['getNotifications', () => notifications.getNotifications('user')],
  ['addNotification', () => notifications.addNotification('user', 'A', 'B')],
  ['markAllNotificationsRead', () => notifications.markAllNotificationsRead('user')],
  ['getManagedSmartLock', () => smartLock.getManagedSmartLock()],
  ['assignSmartLockToRoom', () => smartLock.assignSmartLockToRoom('room-a101', 'admin')],
  ['unassignSmartLock', () => smartLock.unassignSmartLock('admin')],
  ['reserveSmartLockPasswordId', () => smartLock.reserveSmartLockPasswordId('room-a101')],
];

describe('every client request maps to a server endpoint', () => {
  const routes = serverRoutes();

  test('the controller declares the expected API surface', () => {
    expect(routes.length).toBeGreaterThanOrEqual(45);
    expect(routes.every(route => route.template.startsWith('/api/'))).toBe(true);
  });

  test.each(SERVICE_CALLS)('%s', async (_name, call) => {
    await call();
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      const match = routes.find(route => route.method === request.method && route.pattern.test(request.path));
      if (!match) {
        throw new Error(`Server không có endpoint cho ${request.method} ${request.path}`);
      }
    }
  });

  test('every server endpoint is used by the app', async () => {
    const used = new Set<string>();
    for (const [, call] of SERVICE_CALLS) {
      requests.length = 0;
      await call();
      requests.forEach(request => {
        const match = routes.find(route => route.method === request.method && route.pattern.test(request.path));
        if (match) used.add(`${match.method} ${match.template}`);
      });
    }
    const unused = routes.map(route => `${route.method} ${route.template}`).filter(key => !used.has(key));
    expect(unused).toEqual([]);
  });
});

describe('session and payload behaviour', () => {
  test('login stores the bearer token for later requests', async () => {
    expect(await auth.authenticate('user', '2')).toEqual({ username: 'user', role: 'user' });
    await bookings.getBookings();
    expect(requests[0].headers).not.toHaveProperty('Authorization');
    expect(requests[1].headers).toMatchObject({ Authorization: 'Bearer session-token' });
  });

  test('wrong credentials return null instead of throwing', async () => {
    expect(await auth.authenticate('user', 'wrong')).toBeNull();
  });

  test('registration also starts a session', async () => {
    await auth.registerAccount({ username: 'new', password: 'abcd' });
    await bookings.getBookings();
    expect(requests[0].body).toEqual({ username: 'new', password: 'abcd', recoveryCode: '000000' });
    expect(requests[1].headers).toMatchObject({ Authorization: 'Bearer register-token' });
  });

  test('series ids are URL-encoded', async () => {
    await bookings.reviewRecurringSeries(SERIES_ID, 'APPROVED', 'admin');
    expect(requests[0].path).toBe('/api/booking-series/series%201%2Fa/review');
    expect(requests[0].body).toEqual({ decision: 'APPROVED' });
  });

  test('createRoom normalizes before sending', async () => {
    await rooms.createRoom({ ...ROOM_INPUT, name: ' a901 ', location: ' ' }, 'admin');
    expect(requests[0].body).toMatchObject({ name: 'A901', location: 'Tầng 1, tòa nhà A' });
  });

  test('createRoom validates locally before any request', async () => {
    await expect(rooms.createRoom({ ...ROOM_INPUT, floor: 9 }, 'admin')).rejects.toThrow('Tầng phải nằm trong khoảng 1 đến 8.');
    expect(requests).toHaveLength(0);
  });

  test('a room observation is sent separately from maintenance', async () => {
    await bookings.reportRoomObservation('b1', 'user', ' Thiếu bút viết bảng ');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/api/bookings/b1/room-observation',
      body: { note: 'Thiếu bút viết bảng' },
    });
  });

  test('updateBooking refuses to write locally while remote sync is on', async () => {
    await expect(bookings.updateBooking('b1', current => current))
      .rejects.toThrow('Không thể ghi trực tiếp booking local khi chế độ đồng bộ máy chủ đang bật.');
  });

  test('a server error message surfaces to the caller', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false, status: 409, text: async () => JSON.stringify({ message: 'Phòng đã có yêu cầu khác trong khoảng thời gian này.' }),
    })) as unknown as typeof fetch;
    await expect(bookings.createBooking({
      requesterUsername: 'user', roomId: 'room-a101', date: '2030-01-11', startTime: '09:00', endTime: '10:00', purpose: 'x',
    })).rejects.toThrow('Phòng đã có yêu cầu khác trong khoảng thời gian này.');
  });
});
