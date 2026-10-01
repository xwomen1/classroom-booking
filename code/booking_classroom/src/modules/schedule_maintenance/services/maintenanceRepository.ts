import { apiRequest, isRemoteApiEnabled } from '../../../core/api/client';
import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { getRoomById } from '../../room_management/services/roomRepository';
import type { MaintenanceRecord } from '../model/maintenance';
import { assertAccountRole } from '../../auth/services/accountRepository';
import { addNotification } from '../../notifications';
import type { Booking } from '../../booking/model/booking';
import type { MaintenanceRequest } from '../model/maintenance';

const MAINTENANCE_KEY = 'maintenance.records';
const MAINTENANCE_REQUEST_KEY = 'maintenance.requests';

export async function getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
  if (isRemoteApiEnabled()) {
    return apiRequest<MaintenanceRecord[]>('/api/maintenance');
  }
  return readJson<MaintenanceRecord[]>(MAINTENANCE_KEY, []);
}

export async function getMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  if (isRemoteApiEnabled()) {
    return apiRequest<MaintenanceRequest[]>('/api/maintenance/requests');
  }
  return readJson<MaintenanceRequest[]>(MAINTENANCE_REQUEST_KEY, []);
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

export async function requestRoomMaintenance(
  bookingId: string,
  username: string,
  reason: string,
  now = new Date(),
): Promise<MaintenanceRequest> {
  await assertAccountRole(username, 'user');
  if (!reason.trim()) throw new Error('Vui lòng nhập lý do yêu cầu bảo trì.');
  const bookings = await readJson<Booking[]>('booking.records', []);
  const booking = bookings.find(item => item.id === bookingId);
  if (!booking || booking.requesterUsername !== username) {
    throw new Error('Bạn không có quyền báo sự cố cho lượt đặt phòng này.');
  }
  if (booking.status !== 'APPROVED') throw new Error('Phòng phải được duyệt trước khi báo sự cố.');
  const start = new Date(`${booking.date}T${booking.startTime}:00`);
  const end = new Date(`${booking.date}T${booking.endTime}:00`);
  if (now < start || now > end) {
    throw new Error('Chỉ gửi yêu cầu bảo trì khi bạn đang trong thời gian sử dụng phòng.');
  }
  const requests = await getMaintenanceRequests();
  if (requests.some(item => item.bookingId === bookingId && item.status === 'PENDING')) {
    throw new Error('Lượt sử dụng này đã có yêu cầu bảo trì đang chờ xử lý.');
  }
  const request: MaintenanceRequest = {
    id: `maintenance-request-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bookingId,
    roomId: booking.roomId,
    requesterUsername: username,
    reason: reason.trim(),
    requestedAt: now.toISOString(),
    status: 'PENDING',
  };
  await writeJson(MAINTENANCE_REQUEST_KEY, [request, ...requests]);
  const room = await getRoomById(booking.roomId);
  await addNotification('admin', 'Có yêu cầu bảo trì mới',
    `${username} báo sự cố tại phòng ${room?.name ?? booking.roomId}: ${request.reason}`);
  return request;
}

async function updateMaintenanceRequest(
  id: string,
  update: (request: MaintenanceRequest) => MaintenanceRequest,
): Promise<MaintenanceRequest> {
  const requests = await getMaintenanceRequests();
  const index = requests.findIndex(item => item.id === id);
  if (index < 0) throw new Error('Không tìm thấy yêu cầu bảo trì.');
  const updated = update(requests[index]);
  const next = [...requests];
  next[index] = updated;
  await writeJson(MAINTENANCE_REQUEST_KEY, next);
  return updated;
}

export async function scheduleMaintenanceFromRequest(
  requestId: string,
  input: {
    roomId: string; date: string; startTime: string; endTime: string;
    reason: string; createdBy: string;
  },
): Promise<MaintenanceRecord> {
  await assertAccountRole(input.createdBy, 'admin');
  const request = (await getMaintenanceRequests()).find(item => item.id === requestId);
  if (!request || request.status !== 'PENDING') throw new Error('Yêu cầu bảo trì đã được xử lý.');
  if (request.roomId !== input.roomId) throw new Error('Lịch bảo trì phải áp dụng cho đúng phòng được báo sự cố.');
  const record = await createMaintenance(input);
  const reviewedAt = new Date().toISOString();
  await updateMaintenanceRequest(requestId, current => ({
    ...current,
    status: 'SCHEDULED',
    reviewedAt,
    reviewedBy: input.createdBy,
    maintenanceRecordId: record.id,
  }));
  const room = await getRoomById(request.roomId);
  await addNotification(request.requesterUsername, 'Yêu cầu bảo trì đã được tiếp nhận',
    `Phòng ${room?.name ?? request.roomId} được lên lịch bảo trì ${record.date} ${record.startTime}–${record.endTime}.`);
  return record;
}

export async function rejectMaintenanceRequest(
  requestId: string,
  adminUsername: string,
  note = '',
): Promise<MaintenanceRequest> {
  await assertAccountRole(adminUsername, 'admin');
  const updated = await updateMaintenanceRequest(requestId, current => {
    if (current.status !== 'PENDING') throw new Error('Yêu cầu bảo trì đã được xử lý.');
    return {
      ...current,
      status: 'REJECTED',
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminUsername,
      adminNote: note.trim() || undefined,
    };
  });
  const room = await getRoomById(updated.roomId);
  await addNotification(updated.requesterUsername, 'Yêu cầu bảo trì chưa được tiếp nhận',
    `Phòng ${room?.name ?? updated.roomId}.${updated.adminNote ? ` Ghi chú: ${updated.adminNote}` : ''}`);
  return updated;
}
