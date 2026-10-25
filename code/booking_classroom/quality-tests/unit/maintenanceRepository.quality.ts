/* eslint-env jest */
import {
  cancelMaintenance,
  createMaintenance,
  getMaintenanceRecords,
  getMaintenanceRequests,
  hasMaintenanceConflict,
  periodsOverlap,
  rejectMaintenanceRequest,
  requestRoomMaintenance,
  scheduleMaintenanceFromRequest,
} from '../../src/modules/schedule_maintenance/services/maintenanceRepository';
import { getNotifications } from '../../src/modules/notifications';
import { registerAccount } from '../../src/modules/auth';
import { makeBooking, resetStorage, seedBookings } from '../support/testUtils';

const DATE = '2030-01-11';
const base = { roomId: 'room-a101', date: DATE, startTime: '13:00', endTime: '15:00', reason: 'Sửa điện', createdBy: 'admin' };

beforeEach(async () => {
  await resetStorage();
});

describe('periodsOverlap', () => {
  test.each([
    ['09:00', '10:00', '10:00', '11:00', false],
    ['09:00', '10:00', '08:00', '09:00', false],
    ['09:00', '10:00', '09:59', '11:00', true],
    ['09:00', '12:00', '10:00', '11:00', true],
  ])('%s–%s vs %s–%s → %s', (startA, endA, startB, endB, expected) => {
    expect(periodsOverlap(DATE, startA, endA, DATE, startB, endB)).toBe(expected);
  });

  test('different days never overlap', () => {
    expect(periodsOverlap('2030-01-11', '09:00', '10:00', '2030-01-12', '09:00', '10:00')).toBe(false);
  });
});

describe('createMaintenance', () => {
  test('validates permission, room and time range', async () => {
    await expect(createMaintenance({ ...base, createdBy: 'user' })).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
    await expect(createMaintenance({ ...base, roomId: 'missing' })).rejects.toThrow('Không tìm thấy phòng.');
    await expect(createMaintenance({ ...base, date: '11/01/2030' })).rejects.toThrow('Ngày hoặc khoảng giờ bảo trì không hợp lệ.');
    await expect(createMaintenance({ ...base, startTime: '15:00', endTime: '13:00' })).rejects.toThrow('Ngày hoặc khoảng giờ bảo trì không hợp lệ.');
    await expect(createMaintenance({ ...base, reason: ' ' })).rejects.toThrow('Vui lòng nhập lý do bảo trì.');
  });

  test('blocks overlapping maintenance but ignores cancelled maintenance', async () => {
    const first = await createMaintenance(base);
    await expect(createMaintenance({ ...base, startTime: '14:00', endTime: '16:00' }))
      .rejects.toThrow('Phòng đã có lịch bảo trì trùng thời gian.');
    await cancelMaintenance(first.id, 'admin');
    await expect(createMaintenance({ ...base, startTime: '14:00', endTime: '16:00' })).resolves.toBeDefined();
  });

  test('blocks maintenance over an approved booking, but not over a pending one', async () => {
    await seedBookings([
      makeBooking({ roomId: 'room-a101', date: DATE, startTime: '13:30', endTime: '14:30', status: 'APPROVED' }),
      makeBooking({ roomId: 'room-floor-1-2', date: DATE, startTime: '13:30', endTime: '14:30', status: 'PENDING' }),
    ]);
    await expect(createMaintenance(base))
      .rejects.toThrow('Phòng có yêu cầu đã duyệt trùng thời gian; cần đổi phòng trước khi lên lịch bảo trì.');
    await expect(createMaintenance({ ...base, roomId: 'room-floor-1-2' })).resolves.toBeDefined();
  });

  test('trims the reason, stores newest first and reports conflicts', async () => {
    await createMaintenance({ ...base, reason: '  Sơn tường ' });
    const second = await createMaintenance({ ...base, startTime: '16:00', endTime: '17:00' });
    const records = await getMaintenanceRecords();
    expect(records[0].id).toBe(second.id);
    expect(records[1].reason).toBe('Sơn tường');
    expect(await hasMaintenanceConflict('room-a101', DATE, '14:59', '15:30')).toBe(true);
    expect(await hasMaintenanceConflict('room-a101', DATE, '15:00', '16:00')).toBe(false);
  });

  test('cancelMaintenance requires admin and an existing record', async () => {
    await expect(cancelMaintenance('missing', 'admin')).rejects.toThrow('Không tìm thấy lịch bảo trì.');
    const record = await createMaintenance(base);
    await expect(cancelMaintenance(record.id, 'user')).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });
});

describe('yêu cầu bảo trì từ người dùng', () => {
  const during = new Date(2030, 0, 11, 9, 30);

  beforeEach(async () => {
    await registerAccount({ username: 'other', password: 'pass' });
    await seedBookings([
      makeBooking({ id: 'mine', status: 'APPROVED', date: DATE, startTime: '09:00', endTime: '10:00' }),
      makeBooking({ id: 'pending', status: 'PENDING', date: DATE, startTime: '11:00', endTime: '12:00' }),
    ]);
  });

  test('only the owner of an approved booking, during the session, can report', async () => {
    await expect(requestRoomMaintenance('mine', 'user', ' ', during)).rejects.toThrow('Vui lòng nhập lý do yêu cầu bảo trì.');
    await expect(requestRoomMaintenance('mine', 'other', 'Hỏng', during)).rejects.toThrow('Bạn không có quyền báo sự cố cho lượt đặt phòng này.');
    await expect(requestRoomMaintenance('pending', 'user', 'Hỏng', new Date(2030, 0, 11, 11, 30))).rejects.toThrow('Phòng phải được duyệt trước khi báo sự cố.');
    await expect(requestRoomMaintenance('mine', 'user', 'Hỏng', new Date(2030, 0, 11, 8, 59))).rejects.toThrow('Chỉ gửi yêu cầu bảo trì khi bạn đang trong thời gian sử dụng phòng.');
    await expect(requestRoomMaintenance('mine', 'user', 'Hỏng', new Date(2030, 0, 11, 10, 1))).rejects.toThrow('Chỉ gửi yêu cầu bảo trì khi bạn đang trong thời gian sử dụng phòng.');
  });

  test('a booking can only have one pending request and the admin is notified', async () => {
    const request = await requestRoomMaintenance('mine', 'user', ' Máy chiếu không lên ', during);
    expect(request).toMatchObject({ status: 'PENDING', reason: 'Máy chiếu không lên', roomId: 'room-a101' });
    await expect(requestRoomMaintenance('mine', 'user', 'Lại hỏng', during))
      .rejects.toThrow('Lượt sử dụng này đã có yêu cầu bảo trì đang chờ xử lý.');
    expect((await getNotifications('admin'))[0].title).toBe('Có yêu cầu bảo trì mới');
  });

  test('admin rejects with a note; a processed request cannot be rejected again', async () => {
    const request = await requestRoomMaintenance('mine', 'user', 'Hỏng', during);
    const rejected = await rejectMaintenanceRequest(request.id, 'admin', '  Đã kiểm tra, bình thường ');
    expect(rejected).toMatchObject({ status: 'REJECTED', adminNote: 'Đã kiểm tra, bình thường', reviewedBy: 'admin' });
    await expect(rejectMaintenanceRequest(request.id, 'admin')).rejects.toThrow('Yêu cầu bảo trì đã được xử lý.');
    expect((await getNotifications('user'))[0].message).toContain('Ghi chú: Đã kiểm tra, bình thường');
  });

  test('scheduling must target the reported room and links the record', async () => {
    const request = await requestRoomMaintenance('mine', 'user', 'Hỏng', during);
    await expect(scheduleMaintenanceFromRequest(request.id, { ...base, roomId: 'room-floor-1-2' }))
      .rejects.toThrow('Lịch bảo trì phải áp dụng cho đúng phòng được báo sự cố.');

    const record = await scheduleMaintenanceFromRequest(request.id, base);
    const [stored] = await getMaintenanceRequests();
    expect(stored).toMatchObject({ status: 'SCHEDULED', maintenanceRecordId: record.id });
    await expect(scheduleMaintenanceFromRequest(request.id, base)).rejects.toThrow('Yêu cầu bảo trì đã được xử lý.');
  });
});
