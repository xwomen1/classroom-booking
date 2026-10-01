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
  if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') return 'CANCELLED';
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

function isStillActive(booking: Booking, now = new Date()) {
  return ACTIVE_STATUSES.includes(booking.status) && toLocalDateTime(booking.date, booking.endTime) > now;
}

async function validateBooking(input: CreateBookingInput, bookings: Booking[]) {
  const room = await getRoomById(input.roomId);
  if (!room || room.status !== 'AVAILABLE') throw new Error('Phòng không tồn tại hoặc đang tạm khóa/bảo trì.');
  const { start } = validateDateAndTime(input.date, input.startTime, input.endTime);
  const configuration = await getConfiguration();
  const dayDifference = calendarDayDifference(start, new Date());
  if (dayDifference < configuration.minAdvanceDays || dayDifference > configuration.maxAdvanceDays) {
    throw new Error(`Chỉ được đặt trước từ ${configuration.minAdvanceDays} đến ${configuration.maxAdvanceDays} ngày.`);
  }
  if (await hasMaintenanceConflict(input.roomId, input.date, input.startTime, input.endTime)) {
    throw new Error('Phòng có lịch bảo trì trong khoảng thời gian này.');
  }
  const activeBookings = bookings.filter(item => isStillActive(item));
  if (activeBookings.some(item => item.roomId === input.roomId && overlaps(item, input.date, input.startTime, input.endTime))) {
    throw new Error('Phòng đã có yêu cầu khác trong khoảng thời gian này.');
  }
  if (activeBookings.some(item => item.requesterUsername === input.requesterUsername && overlaps(item, input.date, input.startTime, input.endTime))) {
    throw new Error('Bạn đã có lịch đặt khác trùng thời gian.');
  }
  if (activeBookings.filter(item => item.requesterUsername === input.requesterUsername).length >= configuration.maxActiveBookingsPerUser) {
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
  await assertAccountRole(input.requesterUsername, 'user');
  const bookings = await getBookings();
  await validateBooking(input, bookings);
  const booking: Booking = {
    ...input, purpose: input.purpose.trim(), id: `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status: 'PENDING', createdAt: new Date().toISOString(),
  };
  await writeJson(BOOKINGS_KEY, [...bookings, booking]);
  const room = await getRoomById(input.roomId);
  await addNotification('admin', 'Có yêu cầu đặt phòng mới', `${input.requesterUsername} yêu cầu đặt phòng ${room?.name}.`);
  return booking;
}

export async function updateBooking(id: string, update: (booking: Booking) => Booking): Promise<Booking> {
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
    if (toLocalDateTime(target.date, target.startTime) <= new Date()) throw new Error('Không thể duyệt yêu cầu đã đến giờ sử dụng.');
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

export async function cancelBooking(id: string, username: string): Promise<Booking> {
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

export async function setPickupDelegate(id: string, username: string, fullName: string, studentId: string): Promise<Booking> {
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
  if (isRemoteApiEnabled()) return undefined;
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

export async function changeBookingRoom(id: string, newRoomId: string, adminUsername: string, reason: string): Promise<Booking> {
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
