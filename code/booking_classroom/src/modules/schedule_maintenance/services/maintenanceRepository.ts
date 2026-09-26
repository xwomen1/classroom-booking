import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { getRoomById } from '../../room_management/services/roomRepository';
import type { MaintenanceRecord } from '../model/maintenance';
import { assertAccountRole } from '../../auth/services/accountRepository';

const MAINTENANCE_KEY = 'maintenance.records';

export async function getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
  return readJson<MaintenanceRecord[]>(MAINTENANCE_KEY, []);
}

export function periodsOverlap(
  dateA: string, startA: string, endA: string,
  dateB: string, startB: string, endB: string,
) {
  return dateA === dateB && startA < endB && endA > startB;
}

export async function hasMaintenanceConflict(
  roomId: string, date: string, startTime: string, endTime: string,
): Promise<boolean> {
  const records = await getMaintenanceRecords();
  return records.some(item => !item.cancelledAt && item.roomId === roomId &&
    periodsOverlap(item.date, item.startTime, item.endTime, date, startTime, endTime));
}

export async function createMaintenance(input: {
  roomId: string; date: string; startTime: string; endTime: string;
  reason: string; createdBy: string;
}): Promise<MaintenanceRecord> {
  await assertAccountRole(input.createdBy, 'admin');
  if (!(await getRoomById(input.roomId))) throw new Error('Không tìm thấy phòng.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.startTime) ||
      !/^\d{2}:\d{2}$/.test(input.endTime) || input.startTime >= input.endTime) {
    throw new Error('Ngày hoặc khoảng giờ bảo trì không hợp lệ.');
  }
  if (!input.reason.trim()) throw new Error('Vui lòng nhập lý do bảo trì.');
  if (await hasMaintenanceConflict(input.roomId, input.date, input.startTime, input.endTime)) {
    throw new Error('Phòng đã có lịch bảo trì trùng thời gian.');
  }
  const bookings = await readJson<Array<{ roomId: string; date: string; startTime: string; endTime: string; status: string }>>('booking.records', []);
  if (bookings.some(item => item.roomId === input.roomId && item.status === 'APPROVED' &&
      periodsOverlap(item.date, item.startTime, item.endTime, input.date, input.startTime, input.endTime))) {
    throw new Error('Phòng có yêu cầu đã duyệt trùng thời gian; cần đổi phòng trước khi lên lịch bảo trì.');
  }
  const record: MaintenanceRecord = {
    ...input, reason: input.reason.trim(),
    id: `maintenance-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const records = await getMaintenanceRecords();
  await writeJson(MAINTENANCE_KEY, [record, ...records]);
  return record;
}

export async function cancelMaintenance(id: string, adminUsername: string): Promise<void> {
  await assertAccountRole(adminUsername, 'admin');
  const records = await getMaintenanceRecords();
  const index = records.findIndex(item => item.id === id);
  if (index < 0) throw new Error('Không tìm thấy lịch bảo trì.');
  const next = [...records];
  next[index] = { ...next[index], cancelledAt: new Date().toISOString() };
  await writeJson(MAINTENANCE_KEY, next);
}
