import { apiRequest, isRemoteApiEnabled } from '../../../core/api/client';
import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { getConfiguration } from '../../configuration/services/configurationRepository';
import { addNotification } from '../../notifications';
import { getRoomById } from '../../room_management/services/roomRepository';
import type { Room } from '../../room_management/model/room';
import { hasMaintenanceConflict } from '../../schedule_maintenance/services/maintenanceRepository';
import type { Booking, BookingStatus, CreateBookingInput } from '../model/booking';
import { assertAccountRole } from '../../auth/services/accountRepository';
import { grantRoomPinPermission } from '../../access_control/services/roomPinPermissionRepository';
import type { UserRole } from '../../../core/types/userRole';
import type { SmartLockAccessEvent } from '../model/booking';

const BOOKINGS_KEY = 'booking.records';
const ACTIVE_STATUSES: readonly BookingStatus[] = ['PENDING', 'APPROVED'];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildRecurringBookingInputs(input: CreateBookingInput): CreateBookingInput[] {
  const repeatWeekly = Boolean(input.repeatWeekly);
  const repeatWeeks = Number.isInteger(input.repeatWeeks) ? Math.max(1, Math.min(8, input.repeatWeeks!)) : 1;

  if (!repeatWeekly) {
    return [{ ...input, repeatWeekly: false, repeatWeeks: 1 }];
  }

  const baseDate = new Date(`${input.date}T00:00:00`);
  const results: CreateBookingInput[] = [];

  for (let index = 0; index < repeatWeeks; index += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index * 7);
    results.push({
      ...input,
      date: formatDate(date),
      repeatWeekly: true,
      repeatWeeks: repeatWeeks,
    });
  }

  return results;
}

export function meetsReplacementRoomRequirements(currentRoom: Room, candidate: Room): boolean {
  const candidateEquipment = new Set(candidate.equipment.map(item => item.trim().toLowerCase()));
  return candidate.id !== currentRoom.id &&
    candidate.status === 'AVAILABLE' &&
    candidate.lockType === currentRoom.lockType &&
    candidate.capacity >= currentRoom.capacity &&
    currentRoom.equipment.every(item => candidateEquipment.has(item.trim().toLowerCase()));
}

export function toLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export async function getBookings(): Promise<Booking[]> {
  if (isRemoteApiEnabled()) {
    return apiRequest<Booking[]>('/api/bookings');
  }
  return readJson<Booking[]>(BOOKINGS_KEY, []);
}

export async function getBookingsForUser(username: string): Promise<Booking[]> {
  return (await getBookings()).filter(booking => booking.requesterUsername === username)
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
}

export async function getBookingById(id: string): Promise<Booking | undefined> {
  return (await getBookings()).find(booking => booking.id === id);
}

export function getBookingTimeCategory(booking: Booking, now = new Date()): 'UPCOMING' | 'USED' | 'CANCELLED' {
  if (booking.status === 'CANCELLED' || booking.status === 'REJECTED' || booking.status === 'NO_SHOW') return 'CANCELLED';
  if (toLocalDateTime(booking.date, booking.endTime) < now) {
    return booking.status === 'APPROVED' ? 'USED' : 'CANCELLED';
  }
  return 'UPCOMING';
}

function validateDateAndTime(date: string, startTime: string, endTime: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ngày phải có định dạng YYYY-MM-DD.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    throw new Error('Giờ phải có định dạng HH:mm hợp lệ.');
  }
  const start = toLocalDateTime(date, startTime);
  const end = toLocalDateTime(date, endTime);
  const [year, month, day] = date.split('-').map(Number);
  if (start.getFullYear() !== year || start.getMonth() + 1 !== month || start.getDate() !== day || start >= end) {
    throw new Error('Ngày hoặc khoảng thời gian đặt phòng không hợp lệ.');
  }
  return { start, end };
}

function calendarDayDifference(target: Date, now: Date) {
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86_400_000);
}

function overlaps(booking: Booking, date: string, startTime: string, endTime: string) {
  return booking.date === date && startTime < booking.endTime && endTime > booking.startTime;
}

export function isBookingStillActive(booking: Booking, now = new Date()) {
  return ACTIVE_STATUSES.includes(booking.status) &&
    toLocalDateTime(booking.date, booking.endTime) > now;
}

function hasCheckInEvidence(booking: Booking): boolean {
  return Boolean(
    booking.checkedInAt ||
    booking.checkedOutAt ||
    booking.smartLockAccessEvents?.some(event => event.type === 'CHECK_IN'),
  );
}

async function validateBooking(
  input: CreateBookingInput,
  bookings: Booking[],
  options: { skipAdvanceWindowCheck?: boolean; skipUserLimitCheck?: boolean } = {},
) {
  const room = await getRoomById(input.roomId);
  if (!room || room.status !== 'AVAILABLE') throw new Error('Phòng không tồn tại hoặc đang tạm khóa/bảo trì.');
  const { start, end } = validateDateAndTime(input.date, input.startTime, input.endTime);
  const configuration = await getConfiguration();
  const now = new Date();
  const dayDifference = calendarDayDifference(start, now);
  if (!options.skipAdvanceWindowCheck && (dayDifference < configuration.minAdvanceDays || dayDifference > configuration.maxAdvanceDays)) {
    throw new Error(`Chỉ được đặt trước từ ${configuration.minAdvanceDays} đến ${configuration.maxAdvanceDays} ngày.`);
  }
  if (end <= now) {
    throw new Error('Không thể đặt một khoảng thời gian đã kết thúc.');
  }
  if (await hasMaintenanceConflict(input.roomId, input.date, input.startTime, input.endTime)) {
    throw new Error('Phòng có lịch bảo trì trong khoảng thời gian này.');
  }
  const activeBookings = bookings.filter(item => isBookingStillActive(item));
  if (activeBookings.some(item => item.roomId === input.roomId && overlaps(item, input.date, input.startTime, input.endTime))) {
    throw new Error('Phòng đã có yêu cầu khác trong khoảng thời gian này.');
  }
  if (activeBookings.some(item => item.requesterUsername === input.requesterUsername && overlaps(item, input.date, input.startTime, input.endTime))) {
    throw new Error('Bạn đã có lịch đặt khác trùng thời gian.');
  }
  if (!options.skipUserLimitCheck && activeBookings.filter(item => item.requesterUsername === input.requesterUsername).length >= configuration.maxActiveBookingsPerUser) {
    throw new Error(`Mỗi người chỉ có tối đa ${configuration.maxActiveBookingsPerUser} yêu cầu đang chờ hoặc sắp dùng.`);
  }
  if (!input.purpose.trim()) throw new Error('Vui lòng nhập mục đích sử dụng phòng.');
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(
      '/api/bookings',
      { method: 'POST', body: input },
    );
    return result.booking;
  }

  const repeatWeekly = Boolean(input.repeatWeekly);
  const repeatWeeks = Number.isInteger(input.repeatWeeks) ? Math.max(1, Math.min(8, input.repeatWeeks!)) : 1;
  if (repeatWeekly && (!Number.isInteger(input.repeatWeeks) || input.repeatWeeks! < 1)) {
    throw new Error('Số tuần lặp lại phải là số nguyên dương.');
  }

  await assertAccountRole(input.requesterUsername, 'user');
  const bookings = await getBookings();
  const recurringInputs = buildRecurringBookingInputs({ ...input, repeatWeekly, repeatWeeks });
  const createdBookings: Booking[] = [];
  const recurringSeriesId = repeatWeekly
    ? `booking-series-${Date.now()}-${Math.random().toString(16).slice(2)}`
    : undefined;

  for (const [index, item] of recurringInputs.entries()) {
    await validateBooking(item, [...bookings, ...createdBookings], {
      skipAdvanceWindowCheck: index > 0 && repeatWeekly,
      skipUserLimitCheck: index > 0 && repeatWeekly,
    });
    const booking: Booking = {
      ...item,
      purpose: item.purpose.trim(),
      recurringSeriesId,
      recurringWeekIndex: repeatWeekly ? index : undefined,
      id: `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    createdBookings.push(booking);
  }

  await writeJson(BOOKINGS_KEY, [...bookings, ...createdBookings]);

  const firstRoom = await getRoomById(createdBookings[0].roomId);
  await addNotification(
    'admin',
    'Có yêu cầu đặt phòng mới',
    `${input.requesterUsername} yêu cầu đặt phòng ${firstRoom?.name}${repeatWeekly ? ` và ${createdBookings.length} lịch lặp lại` : ''}.`,
  );

  return createdBookings[0];
}

export async function updateBooking(id: string, update: (booking: Booking) => Booking): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    throw new Error('Không thể ghi trực tiếp booking local khi chế độ đồng bộ máy chủ đang bật.');
  }
  const bookings = await getBookings();
  const index = bookings.findIndex(booking => booking.id === id);
  if (index < 0) throw new Error('Không tìm thấy yêu cầu đặt phòng.');
  const updated = update(bookings[index]);
  const next = [...bookings]; next[index] = updated;
  await writeJson(BOOKINGS_KEY, next);
  return updated;
}

export async function saveTemporaryPin(
  id: string,
  temporaryPin: NonNullable<Booking['temporaryPin']>,
): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(
      `/api/bookings/${id}/temporary-pin`,
      { method: 'POST', body: temporaryPin },
    );
    return result.booking;
  }
  return updateBooking(id, current => ({ ...current, temporaryPin }));
}

export async function reviewBooking(id: string, decision: 'APPROVED' | 'REJECTED', adminUsername: string): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(
      `/api/bookings/${id}/review`,
      { method: 'POST', body: { decision, adminUsername } },
    );
    return result.booking;
  }
  await assertAccountRole(adminUsername, 'admin');
  const bookings = await getBookings();
  const target = bookings.find(item => item.id === id);
  if (!target) throw new Error('Không tìm thấy yêu cầu đặt phòng.');
  if (target.status !== 'PENDING') throw new Error('Yêu cầu này đã được xử lý.');
  if (decision === 'APPROVED') {
    if (toLocalDateTime(target.date, target.endTime) <= new Date()) throw new Error('Không thể duyệt yêu cầu đã hết giờ sử dụng.');
    if (await hasMaintenanceConflict(target.roomId, target.date, target.startTime, target.endTime)) {
      throw new Error('Phòng đã có lịch bảo trì trong khung giờ này.');
    }
    if (bookings.some(item => item.id !== id && item.status === 'APPROVED' && item.roomId === target.roomId && overlaps(item, target.date, target.startTime, target.endTime))) {
      throw new Error('Phòng đã có yêu cầu được duyệt trùng thời gian.');
    }
  }
  const updated = await updateBooking(id, booking => ({
    ...booking,
    status: decision,
    reviewedAt: new Date().toISOString(),
    reviewedBy: adminUsername,
  }));
  const room = await getRoomById(updated.roomId);
  if (decision === 'APPROVED' && room?.lockType === 'PIN_CODE') {
    await grantRoomPinPermission(updated.requesterUsername, updated.roomId, adminUsername);
  }
  await addNotification(updated.requesterUsername, decision === 'APPROVED' ? 'Yêu cầu đã được duyệt' : 'Yêu cầu bị từ chối',
    `Phòng ${room?.name}, ngày ${updated.date} lúc ${updated.startTime}.`);
  return updated;
}

export async function reviewRecurringSeries(
  recurringSeriesId: string,
  decision: 'APPROVED' | 'REJECTED',
  adminUsername: string,
): Promise<number> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ count: number }>(
      `/api/booking-series/${encodeURIComponent(recurringSeriesId)}/review`,
      { method: 'POST', body: { decision } },
    );
    return result.count;
  }
  await assertAccountRole(adminUsername, 'admin');
  const bookings = await getBookings();
  const pending = bookings.filter(item =>
    item.recurringSeriesId === recurringSeriesId && item.status === 'PENDING',
  );
  if (pending.length === 0) throw new Error('Chuỗi này không còn yêu cầu chờ duyệt.');

  if (decision === 'APPROVED') {
    const pendingIds = new Set(pending.map(item => item.id));
    const approvedCandidates: Booking[] = [];
    const now = new Date();
    for (const booking of pending) {
      if (toLocalDateTime(booking.date, booking.endTime) <= now) {
        throw new Error('Có lượt trong chuỗi đã hết giờ sử dụng; chưa lượt nào được duyệt.');
      }
      if (await hasMaintenanceConflict(booking.roomId, booking.date, booking.startTime, booking.endTime)) {
        throw new Error('Có lượt trong chuỗi trùng lịch bảo trì; chưa lượt nào được duyệt.');
      }
      const conflictsWithApproved = bookings.some(item =>
        !pendingIds.has(item.id) &&
        item.status === 'APPROVED' &&
        item.roomId === booking.roomId &&
        overlaps(item, booking.date, booking.startTime, booking.endTime),
      );
      const conflictsWithinSeries = approvedCandidates.some(item =>
        item.roomId === booking.roomId && overlaps(item, booking.date, booking.startTime, booking.endTime),
      );
      if (conflictsWithApproved || conflictsWithinSeries) {
        throw new Error('Có lượt trong chuỗi trùng lịch đã duyệt; chưa lượt nào được duyệt.');
      }
      approvedCandidates.push(booking);
    }
  }

  const reviewedAt = new Date().toISOString();
  const pendingIds = new Set(pending.map(item => item.id));
  const updated = bookings.map(item => pendingIds.has(item.id)
    ? { ...item, status: decision, reviewedAt, reviewedBy: adminUsername }
    : item);
  await writeJson(BOOKINGS_KEY, updated);

  if (decision === 'APPROVED') {
    const pinRoomIds = new Set<string>();
    for (const booking of pending) {
      const room = await getRoomById(booking.roomId);
      if (room?.lockType === 'PIN_CODE') pinRoomIds.add(booking.roomId);
    }
    for (const roomId of pinRoomIds) {
      await grantRoomPinPermission(pending[0].requesterUsername, roomId, adminUsername);
    }
  }

  const requesterUsername = pending[0].requesterUsername;
  const decisionLabel = decision === 'APPROVED' ? 'đã được duyệt' : 'đã bị từ chối';
  await addNotification(
    requesterUsername,
    `Các lượt đặt trong chuỗi ${decisionLabel}`,
    `Admin đã ${decision === 'APPROVED' ? 'duyệt' : 'từ chối'} ${pending.length} lượt đặt phòng lặp lại.`,
  );
  return pending.length;
}

export async function cancelBooking(id: string, username: string): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/cancel`, { method: 'POST' });
    return result.booking;
  }
  await assertAccountRole(username, 'user');
  const configuration = await getConfiguration();
  const updated = await updateBooking(id, booking => {
    if (booking.requesterUsername !== username) throw new Error('Bạn không có quyền hủy yêu cầu này.');
    if (!ACTIVE_STATUSES.includes(booking.status)) throw new Error('Yêu cầu này không thể hủy.');
    const minutesUntilStart = (toLocalDateTime(booking.date, booking.startTime).getTime() - Date.now()) / 60_000;
    if (minutesUntilStart <= 0) throw new Error('Không thể hủy sau khi phiên sử dụng đã bắt đầu.');
    if (booking.status === 'APPROVED' && minutesUntilStart < configuration.cancellationCutoffMinutes) {
      throw new Error(`Yêu cầu đã duyệt chỉ được hủy trước ít nhất ${configuration.cancellationCutoffMinutes} phút.`);
    }
    return { ...booking, status: 'CANCELLED',
      temporaryPin: booking.temporaryPin ? { ...booking.temporaryPin, revokedAt: new Date().toISOString() } : undefined };
  });
  const room = await getRoomById(updated.roomId);
  await addNotification('admin', 'Yêu cầu đã được hủy', `${username} đã hủy yêu cầu phòng ${room?.name}.`);
  return updated;
}

export async function updatePendingRecurringBookings(
  bookingId: string,
  username: string,
  changes: Pick<Booking, 'startTime' | 'endTime' | 'purpose'>,
): Promise<number> {
  if (isRemoteApiEnabled()) {
    const target = await getBookingById(bookingId);
    if (!target?.recurringSeriesId) throw new Error('Không tìm thấy chuỗi đặt lặp lại.');
    const result = await apiRequest<{ count: number }>(
      `/api/booking-series/${encodeURIComponent(target.recurringSeriesId)}/pending`,
      { method: 'PUT', body: changes },
    );
    return result.count;
  }
  await assertAccountRole(username, 'user');
  const bookings = await getBookings();
  const target = bookings.find(item => item.id === bookingId);
  if (!target?.recurringSeriesId) throw new Error('Không tìm thấy chuỗi đặt lặp lại.');
  if (target.requesterUsername !== username) throw new Error('Bạn không có quyền sửa chuỗi đặt này.');

  const now = new Date();
  const pendingFuture = bookings.filter(item =>
    item.recurringSeriesId === target.recurringSeriesId &&
    item.requesterUsername === username &&
    item.status === 'PENDING' &&
    toLocalDateTime(item.date, item.startTime) > now,
  );
  if (pendingFuture.length === 0) throw new Error('Không còn lượt chờ duyệt nào trong tương lai để sửa.');

  const outsideSeries = bookings.filter(item => item.recurringSeriesId !== target.recurringSeriesId);
  for (const booking of pendingFuture) {
    await validateBooking({
      requesterUsername: username,
      roomId: booking.roomId,
      date: booking.date,
      startTime: changes.startTime,
      endTime: changes.endTime,
      purpose: changes.purpose,
    }, outsideSeries, { skipAdvanceWindowCheck: true, skipUserLimitCheck: true });
  }

  const pendingIds = new Set(pendingFuture.map(item => item.id));
  const updated = bookings.map(item => pendingIds.has(item.id)
    ? { ...item, startTime: changes.startTime, endTime: changes.endTime, purpose: changes.purpose.trim() }
    : item);
  await writeJson(BOOKINGS_KEY, updated);
  await addNotification(
    'admin',
    'Đã cập nhật chuỗi đặt phòng',
    `${username} đã sửa ${pendingFuture.length} lượt đang chờ duyệt trong chuỗi đặt phòng.`,
  );
  return pendingFuture.length;
}

export async function cancelFutureRecurringBookings(bookingId: string, username: string): Promise<number> {
  if (isRemoteApiEnabled()) {
    const target = await getBookingById(bookingId);
    if (!target?.recurringSeriesId) throw new Error('Không tìm thấy chuỗi đặt lặp lại.');
    const result = await apiRequest<{ count: number }>(
      `/api/booking-series/${encodeURIComponent(target.recurringSeriesId)}/cancel`,
      { method: 'POST' },
    );
    return result.count;
  }
  await assertAccountRole(username, 'user');
  const configuration = await getConfiguration();
  const bookings = await getBookings();
  const target = bookings.find(item => item.id === bookingId);
  if (!target?.recurringSeriesId) throw new Error('Không tìm thấy chuỗi đặt lặp lại.');
  if (target.requesterUsername !== username) throw new Error('Bạn không có quyền hủy chuỗi đặt này.');

  const now = new Date();
  const futureBookings = bookings.filter(item =>
    item.recurringSeriesId === target.recurringSeriesId &&
    item.requesterUsername === username &&
    ACTIVE_STATUSES.includes(item.status) &&
    toLocalDateTime(item.date, item.startTime) > now,
  );
  if (futureBookings.length === 0) throw new Error('Không còn lượt đặt nào trong tương lai để hủy.');

  for (const booking of futureBookings) {
    const minutesUntilStart = (toLocalDateTime(booking.date, booking.startTime).getTime() - now.getTime()) / 60_000;
    if (booking.status === 'APPROVED' && minutesUntilStart < configuration.cancellationCutoffMinutes) {
      throw new Error(`Có lượt đã duyệt không đủ hạn hủy trước ${configuration.cancellationCutoffMinutes} phút; chưa lượt nào bị hủy.`);
    }
  }

  const futureIds = new Set(futureBookings.map(item => item.id));
  const revokedAt = new Date().toISOString();
  const updated = bookings.map(item => futureIds.has(item.id)
    ? {
      ...item,
      status: 'CANCELLED' as const,
      temporaryPin: item.temporaryPin ? { ...item.temporaryPin, revokedAt } : undefined,
    }
    : item);
  await writeJson(BOOKINGS_KEY, updated);
  await addNotification(
    'admin',
    'Đã hủy các lượt đặt lặp lại',
    `${username} đã hủy ${futureBookings.length} lượt trong chuỗi đặt phòng.`,
  );
  return futureBookings.length;
}

export async function setPickupDelegate(id: string, username: string, fullName: string, studentId: string): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/delegate`, {
      method: 'PUT', body: { fullName, studentId },
    });
    return result.booking;
  }
  await assertAccountRole(username, 'user');
  const booking = await getBookingById(id);
  if (!booking || booking.requesterUsername !== username) throw new Error('Bạn không có quyền cập nhật yêu cầu này.');
  if (booking.status !== 'APPROVED') throw new Error('Chỉ ủy quyền cho yêu cầu đã được duyệt.');
  const room = await getRoomById(booking.roomId);
  if (room?.lockType !== 'PHYSICAL_KEY') throw new Error('Ủy quyền nhận hộ chỉ áp dụng cho khóa cơ/thẻ.');
  if (toLocalDateTime(booking.date, booking.startTime) <= new Date()) throw new Error('Phiên sử dụng đã bắt đầu.');
  if (!fullName.trim() || !studentId.trim()) throw new Error('Cần nhập họ tên và mã sinh viên người nhận hộ.');
  const updated = await updateBooking(id, current => ({ ...current, pickupDelegate: {
    fullName: fullName.trim(), studentId: studentId.trim(), delegatedAt: new Date().toISOString(),
  }}));
  await addNotification('admin', 'Cập nhật người nhận khóa hộ', `${username} ủy quyền ${fullName.trim()} nhận khóa phòng ${room.name}.`);
  return updated;
}

export async function scheduleKeyPickup(id: string, adminUsername: string, date: string, time: string, location: string): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/pickup/schedule`, {
      method: 'POST', body: { date, time, location },
    });
    return result.booking;
  }
  await assertAccountRole(adminUsername, 'admin');
  const booking = await getBookingById(id);
  if (!booking || booking.status !== 'APPROVED') throw new Error('Chỉ hẹn nhận khóa cho yêu cầu đã duyệt.');
  const room = await getRoomById(booking.roomId);
  if (room?.lockType !== 'PHYSICAL_KEY') throw new Error('Phòng này không dùng khóa cơ/thẻ.');
  validateDateAndTime(date, time, '23:59');
  const appointment = toLocalDateTime(date, time);
  if (appointment <= new Date() || appointment >= toLocalDateTime(booking.date, booking.startTime)) {
    throw new Error('Lịch nhận khóa phải ở tương lai và trước giờ sử dụng phòng.');
  }
  if (!location.trim()) throw new Error('Vui lòng nhập địa điểm nhận khóa.');
  const now = new Date().toISOString();
  const proposal = {
    id: `pickup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date,
    time,
    location: location.trim(),
    proposedAt: now,
    proposedBy: adminUsername,
    proposedByRole: 'admin' as const,
  };
  const updated = await updateBooking(id, current => ({ ...current,
    keyPickupAppointment: {
      date, time, location: location.trim(), createdAt: now, createdBy: adminUsername,
      agreedAt: now, agreedBy: adminUsername,
    },
    keyPickupNegotiation: {
      status: 'AGREED', currentProposal: proposal, history: [proposal], agreedAt: now, agreedBy: adminUsername,
    },
  }));
  await addNotification(updated.requesterUsername, 'Đã có lịch nhận khóa', `${date} ${time} tại ${location.trim()} cho phòng ${room.name}.`);
  return updated;
}

function validateKeyPickupTime(booking: Booking, date: string, time: string) {
  validateDateAndTime(date, time, '23:59');
  const appointment = toLocalDateTime(date, time);
  if (appointment <= new Date() || appointment >= toLocalDateTime(booking.date, booking.startTime)) {
    throw new Error('Thời gian nhận khóa phải ở tương lai và trước giờ sử dụng phòng.');
  }
}

export async function proposeKeyPickup(
  id: string,
  actorUsername: string,
  actorRole: UserRole,
  date: string,
  time: string,
  location = '',
): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/pickup/propose`, {
      method: 'POST', body: { date, time, location },
    });
    return result.booking;
  }
  await assertAccountRole(actorUsername, actorRole);
  const booking = await getBookingById(id);
  if (!booking || booking.status !== 'APPROVED') {
    throw new Error('Chỉ thỏa thuận nhận khóa cho yêu cầu đã duyệt.');
  }
  const room = await getRoomById(booking.roomId);
  if (room?.lockType !== 'PHYSICAL_KEY') throw new Error('Phòng này không dùng khóa cơ/thẻ.');
  if (booking.keyPickupNegotiation?.status === 'AGREED') {
    throw new Error('Hai bên đã thống nhất lịch nhận khóa.');
  }
  if (actorRole === 'user') {
    if (booking.requesterUsername !== actorUsername) throw new Error('Bạn không có quyền sửa lịch nhận khóa này.');
    if (booking.keyPickupNegotiation?.status === 'WAITING_ADMIN') {
      throw new Error('Đang chờ quản trị viên phản hồi thời gian bạn đã gửi.');
    }
  } else if (!booking.keyPickupNegotiation || booking.keyPickupNegotiation.status !== 'WAITING_ADMIN') {
    throw new Error('Cần có đề xuất thời gian từ người dùng trước.');
  }
  validateKeyPickupTime(booking, date, time);
  if (actorRole === 'admin' && !location.trim()) {
    throw new Error('Quản trị viên cần nhập địa điểm nhận khóa.');
  }
  const proposal = {
    id: `pickup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date,
    time,
    location: actorRole === 'admin' ? location.trim() : undefined,
    proposedAt: new Date().toISOString(),
    proposedBy: actorUsername,
    proposedByRole: actorRole,
  };
  const updated = await updateBooking(id, current => ({
    ...current,
    keyPickupAppointment: undefined,
    keyPickupNegotiation: {
      status: actorRole === 'user' ? 'WAITING_ADMIN' : 'WAITING_USER',
      currentProposal: proposal,
      history: [...(current.keyPickupNegotiation?.history ?? []), proposal],
    },
  }));
  if (actorRole === 'user') {
    await addNotification('admin', 'Có đề xuất thời gian nhận khóa',
      `${actorUsername} đề xuất ${date} ${time} cho phòng ${room.name}.`);
  } else {
    await addNotification(updated.requesterUsername, 'Quản trị viên đề xuất thời gian nhận khóa khác',
      `${date} ${time} tại ${location.trim()} cho phòng ${room.name}.`);
  }
  return updated;
}

export async function acceptKeyPickupProposal(
  id: string,
  actorUsername: string,
  actorRole: UserRole,
  location = '',
): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/pickup/accept`, {
      method: 'POST', body: { location },
    });
    return result.booking;
  }
  await assertAccountRole(actorUsername, actorRole);
  const booking = await getBookingById(id);
  if (!booking || booking.status !== 'APPROVED') throw new Error('Không tìm thấy yêu cầu đã duyệt.');
  const negotiation = booking.keyPickupNegotiation;
  if (!negotiation || negotiation.status === 'AGREED') throw new Error('Không có đề xuất đang chờ xác nhận.');
  const proposal = negotiation.currentProposal;
  if (proposal.proposedByRole === actorRole) throw new Error('Bên còn lại phải xác nhận đề xuất này.');
  if (actorRole === 'user' && booking.requesterUsername !== actorUsername) {
    throw new Error('Bạn không có quyền xác nhận lịch nhận khóa này.');
  }
  const agreedLocation = proposal.location?.trim() || location.trim();
  if (!agreedLocation) throw new Error('Vui lòng nhập địa điểm nhận khóa trước khi duyệt.');
  validateKeyPickupTime(booking, proposal.date, proposal.time);
  const now = new Date().toISOString();
  const updated = await updateBooking(id, current => ({
    ...current,
    keyPickupAppointment: {
      date: proposal.date,
      time: proposal.time,
      location: agreedLocation,
      createdAt: proposal.proposedAt,
      createdBy: proposal.proposedBy,
      agreedAt: now,
      agreedBy: actorUsername,
    },
    keyPickupNegotiation: {
      ...negotiation,
      status: 'AGREED',
      agreedAt: now,
      agreedBy: actorUsername,
    },
  }));
  const room = await getRoomById(updated.roomId);
  const otherUsername = actorRole === 'admin' ? updated.requesterUsername : 'admin';
  await addNotification(otherUsername, 'Đã thống nhất lịch nhận khóa',
    `${proposal.date} ${proposal.time} tại ${agreedLocation} cho phòng ${room?.name ?? updated.roomId}.`);
  return updated;
}

export async function recordSmartLockAccessEvent(
  roomId: string,
  event: SmartLockAccessEvent,
): Promise<Booking | undefined> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking } | undefined>('/api/bookings/access-event', {
      method: 'POST', body: { roomId, event },
    });
    return result?.booking;
  }
  const eventTime = new Date(event.occurredAt);
  if (Number.isNaN(eventTime.getTime())) return undefined;
  const configuration = await getConfiguration();
  const bookings = await getBookings();
  const candidates = bookings
    .filter(item => item.roomId === roomId && item.status === 'APPROVED')
    .filter(item => {
      const start = toLocalDateTime(item.date, item.startTime).getTime() - configuration.pinGraceMinutes * 60_000;
      const end = toLocalDateTime(item.date, item.endTime).getTime() + configuration.pinGraceMinutes * 60_000;
      return eventTime.getTime() >= start && eventTime.getTime() <= end;
    })
    .sort((a, b) => Math.abs(toLocalDateTime(a.date, a.startTime).getTime() - eventTime.getTime()) -
      Math.abs(toLocalDateTime(b.date, b.startTime).getTime() - eventTime.getTime()));
  const target = event.type === 'CHECK_OUT'
    ? candidates.find(item => item.checkedInAt && !item.checkedOutAt)
    : candidates.find(item => !item.checkedInAt) ?? candidates[0];
  if (!target) return undefined;
  if (event.type === 'CHECK_IN' && target.checkedInAt) return target;
  if (event.type === 'CHECK_OUT' && target.checkedOutAt) return target;
  const index = bookings.findIndex(item => item.id === target.id);
  const updated: Booking = {
    ...target,
    smartLockAccessEvents: [...(target.smartLockAccessEvents ?? []), event],
    ...(event.type === 'CHECK_IN' ? { checkedInAt: event.occurredAt } : { checkedOutAt: event.occurredAt }),
  };
  const next = [...bookings];
  next[index] = updated;
  await writeJson(BOOKINGS_KEY, next);
  const room = await getRoomById(roomId);
  const action = event.type === 'CHECK_IN' ? 'check in' : 'check out';
  await addNotification(updated.requesterUsername, `Đã ghi nhận ${action}`,
    `SmartLock ghi nhận ${action} tại phòng ${room?.name ?? roomId}.`);
  await addNotification('admin', `SmartLock: ${action}`,
    `${updated.requesterUsername} · phòng ${room?.name ?? roomId} · ${new Date(event.occurredAt).toLocaleString('vi-VN')}.`);
  return updated;
}

export async function confirmBookingCheckIn(
  id: string,
  adminUsername: string,
  now = new Date(),
): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/check-in`, { method: 'POST' });
    return result.booking;
  }
  await assertAccountRole(adminUsername, 'admin');
  const bookings = await getBookings();
  const target = bookings.find(item => item.id === id);
  if (!target || target.status !== 'APPROVED') throw new Error('Chỉ xác nhận check-in cho booking đã duyệt.');
  if (hasCheckInEvidence(target)) throw new Error('Booking này đã có check-in được ghi nhận.');
  const room = await getRoomById(target.roomId);
  if (room?.lockType !== 'PHYSICAL_KEY') throw new Error('Check-in thủ công chỉ áp dụng cho phòng khóa cơ/thẻ.');
  const start = toLocalDateTime(target.date, target.startTime);
  const end = toLocalDateTime(target.date, target.endTime);
  if (now < start || now >= end) throw new Error('Chỉ xác nhận có mặt trong thời gian sử dụng phòng.');

  const updated: Booking = { ...target, checkedInAt: now.toISOString(), checkInConfirmedBy: adminUsername };
  const next = [...bookings];
  next[bookings.findIndex(item => item.id === id)] = updated;
  await writeJson(BOOKINGS_KEY, next);
  await addNotification(
    updated.requesterUsername,
    'Đã xác nhận có mặt',
    `Admin đã ghi nhận bạn có mặt tại phòng ${room?.name ?? updated.roomId}.`,
  );
  return updated;
}

export async function confirmBookingNoShow(
  id: string,
  adminUsername: string,
  now = new Date(),
): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/no-show`, { method: 'POST' });
    return result.booking;
  }
  await assertAccountRole(adminUsername, 'admin');
  const bookings = await getBookings();
  const target = bookings.find(item => item.id === id);
  if (!target || target.status !== 'APPROVED') throw new Error('Chỉ xác nhận vắng mặt cho booking đã duyệt.');
  if (hasCheckInEvidence(target)) throw new Error('Booking đã có check-in, không thể ghi nhận vắng mặt.');

  const configuration = await getConfiguration();
  const eligibleAt = toLocalDateTime(target.date, target.startTime).getTime() + configuration.noShowGraceMinutes * 60_000;
  if (now.getTime() < eligibleAt) {
    throw new Error(`Chỉ xác nhận vắng mặt sau ${configuration.noShowGraceMinutes} phút kể từ giờ bắt đầu.`);
  }

  const nowIso = now.toISOString();
  const updated: Booking = {
    ...target,
    status: 'NO_SHOW',
    noShowAt: nowIso,
    noShowMarkedBy: adminUsername,
    temporaryPin: target.temporaryPin ? { ...target.temporaryPin, revokedAt: nowIso } : undefined,
  };
  const next = [...bookings];
  next[bookings.findIndex(item => item.id === id)] = updated;
  await writeJson(BOOKINGS_KEY, next);
  const room = await getRoomById(updated.roomId);
  await addNotification(
    updated.requesterUsername,
    'Đã ghi nhận vắng mặt',
    `Admin xác nhận không có check-in cho phòng ${room?.name ?? updated.roomId}; lượt đặt đã được đóng và mã truy cập thu hồi.`,
  );
  return updated;
}

export async function changeBookingRoom(id: string, newRoomId: string, adminUsername: string, reason: string): Promise<Booking> {
  if (isRemoteApiEnabled()) {
    const result = await apiRequest<{ booking: Booking }>(`/api/bookings/${id}/change-room`, {
      method: 'POST',
      body: { roomId: newRoomId, reason },
    });
    return result.booking;
  }
  await assertAccountRole(adminUsername, 'admin');
  const bookings = await getBookings();
  const booking = bookings.find(item => item.id === id);
  if (!booking || booking.status !== 'APPROVED') throw new Error('Chỉ đổi phòng cho yêu cầu đã duyệt.');
  if (booking.roomId === newRoomId) throw new Error('Hãy chọn một phòng khác.');
  const configuration = await getConfiguration();
  const minutesUntilStart = (toLocalDateTime(booking.date, booking.startTime).getTime() - Date.now()) / 60_000;
  if (minutesUntilStart < configuration.roomChangeCutoffMinutes) {
    throw new Error(`Chỉ được đổi phòng trước giờ bắt đầu ít nhất ${configuration.roomChangeCutoffMinutes} phút.`);
  }
  if (!reason.trim()) throw new Error('Vui lòng nhập lý do đổi phòng.');
  const oldRoom = await getRoomById(booking.roomId);
  if (!oldRoom) throw new Error('Không tìm thấy thông tin phòng hiện tại.');
  const room = await getRoomById(newRoomId);
  if (!room || room.status !== 'AVAILABLE') throw new Error('Phòng thay thế không khả dụng.');
  if (room.lockType !== oldRoom.lockType) throw new Error('Phòng thay thế phải có cùng loại khóa với phòng hiện tại.');
  if (room.capacity < oldRoom.capacity) throw new Error('Phòng thay thế phải có sức chứa bằng hoặc lớn hơn phòng hiện tại.');
  const replacementEquipment = new Set(room.equipment.map(item => item.trim().toLowerCase()));
  if (oldRoom.equipment.some(item => !replacementEquipment.has(item.trim().toLowerCase()))) {
    throw new Error('Phòng thay thế phải có đầy đủ thiết bị của phòng hiện tại.');
  }
  if (await hasMaintenanceConflict(newRoomId, booking.date, booking.startTime, booking.endTime)) {
    throw new Error('Phòng thay thế có lịch bảo trì trong khung giờ này.');
  }
  if (bookings.some(item => item.id !== id && ACTIVE_STATUSES.includes(item.status) && item.roomId === newRoomId && overlaps(item, booking.date, booking.startTime, booking.endTime))) {
    throw new Error('Phòng thay thế đã có yêu cầu chờ hoặc yêu cầu được duyệt trùng thời gian.');
  }
  const updated = await updateBooking(id, current => ({
    ...current, roomId: newRoomId, userCanGeneratePin: false,
    keyPickupAppointment: undefined, keyPickupNegotiation: undefined,
    temporaryPin: current.temporaryPin ? { ...current.temporaryPin, revokedAt: new Date().toISOString() } : undefined,
    roomChanges: [...(current.roomChanges ?? []), { fromRoomId: current.roomId, toRoomId: newRoomId,
      changedAt: new Date().toISOString(), changedBy: adminUsername, reason: reason.trim() }],
  }));
  if (room.lockType === 'PIN_CODE') {
    await grantRoomPinPermission(updated.requesterUsername, newRoomId, adminUsername);
    await updateBooking(id, current => ({ ...current, userCanGeneratePin: true }));
  }
  await addNotification(updated.requesterUsername, 'Đặt phòng đã được đổi phòng',
    `${oldRoom?.name} được đổi sang ${room.name}. Lý do: ${reason.trim()}`);
  return updated;
}
