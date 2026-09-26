import { storage } from '../src/core/storage/jsonStorage';
import {
  authenticate,
  createManagedAccount,
  resetPasswordWithRecoveryCode,
  updateManagedAccount,
} from '../src/modules/auth';
import {
  changeBookingRoom,
  createBooking,
  reviewBooking,
  scheduleKeyPickup,
  setPickupDelegate,
} from '../src/modules/booking';
import { saveConfiguration } from '../src/modules/configuration';
import {
  createRoom,
  deleteRoom,
  getRooms,
  updateRoom,
} from '../src/modules/room_management';
import { createMaintenance } from '../src/modules/schedule_maintenance';

function dateAfter(days: number): string {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('complete local business rules', () => {
  beforeEach(async () => { await storage.clear(); });

  test('enforces admin account management and local recovery', async () => {
    await expect(createManagedAccount({ username: 'teacher01', password: '1234', recoveryCode: '9876', role: 'user' }, 'user')).rejects.toThrow('không có quyền');
    await createManagedAccount({ username: 'teacher01', password: '1234', recoveryCode: '9876', role: 'user' }, 'admin');
    await updateManagedAccount('teacher01', { active: false }, 'admin');
    await expect(authenticate('teacher01', '1234')).resolves.toBeNull();
    await updateManagedAccount('teacher01', { active: true }, 'admin');
    await resetPasswordWithRecoveryCode('teacher01', '9876', '5678');
    await expect(authenticate('teacher01', '5678')).resolves.toEqual({ username: 'teacher01', role: 'user' });
  });

  test('supports room CRUD and rejects non-admin mutations', async () => {
    await expect(createRoom({ name: 'C303', floor: 3, location: 'Nhà C', capacity: 20, equipment: [], lockType: 'PIN_CODE', status: 'AVAILABLE' }, 'user')).rejects.toThrow('không có quyền');
    const room = await createRoom({ name: 'C303', floor: 3, location: 'Nhà C', capacity: 20, equipment: ['TV'], lockType: 'PIN_CODE', status: 'AVAILABLE' }, 'admin');
    const updated = await updateRoom(room.id, { name: 'C304', floor: 3, location: 'Nhà C', capacity: 25, equipment: ['TV'], lockType: 'PHYSICAL_KEY', status: 'AVAILABLE' }, 'admin');
    expect(updated.name).toBe('C304');
    await deleteRoom(room.id, 'admin');
    expect((await getRooms()).some(item => item.id === room.id)).toBe(false);
  });

  test('blocks booking during maintenance and uses configurable limits', async () => {
    await saveConfiguration({ minAdvanceDays: 1, maxAdvanceDays: 5, maxActiveBookingsPerUser: 3, cancellationCutoffMinutes: 45, roomChangeCutoffMinutes: 30, pinGraceMinutes: 10, notificationsEnabled: true }, 'admin');
    const date = dateAfter(4);
    await createMaintenance({ roomId: 'room-a101', date, startTime: '08:00', endTime: '09:00', reason: 'Kiểm tra khóa', createdBy: 'admin' });
    await expect(createBooking({ requesterUsername: 'user', roomId: 'room-a101', date, startTime: '08:15', endTime: '08:45', purpose: 'Họp' })).rejects.toThrow('lịch bảo trì');
    await expect(createBooking({ requesterUsername: 'user', roomId: 'room-b202', date, startTime: '10:00', endTime: '11:00', purpose: 'Họp' })).resolves.toMatchObject({ status: 'PENDING' });
  });

  test('handles physical-key appointment, delegation and emergency room change', async () => {
    const date = dateAfter(1);
    const physical = await createBooking({ requesterUsername: 'user', roomId: 'room-b202', date, startTime: '15:00', endTime: '16:00', purpose: 'Giảng bài' });
    await reviewBooking(physical.id, 'APPROVED', 'admin');
    const appointment = await scheduleKeyPickup(physical.id, 'admin', date, '14:00', 'Phòng trực A1');
    expect(appointment.keyPickupAppointment?.location).toBe('Phòng trực A1');
    const delegated = await setPickupDelegate(physical.id, 'user', 'Nguyễn Văn B', '20250001');
    expect(delegated.pickupDelegate?.studentId).toBe('20250001');

    const digital = await createBooking({ requesterUsername: 'user', roomId: 'room-a101', date, startTime: '17:00', endTime: '18:00', purpose: 'Họp khẩn' });
    await reviewBooking(digital.id, 'APPROVED', 'admin');
    await expect(changeBookingRoom(digital.id, 'room-b202', 'admin', 'A101 cần phục vụ sự kiện ưu tiên')).rejects.toThrow('cùng loại khóa');
    const moved = await changeBookingRoom(digital.id, 'room-floor-2-1', 'admin', 'A101 cần phục vụ sự kiện ưu tiên');
    expect(moved.roomId).toBe('room-floor-2-1');
    expect(moved.roomChanges).toHaveLength(1);
  });
});
