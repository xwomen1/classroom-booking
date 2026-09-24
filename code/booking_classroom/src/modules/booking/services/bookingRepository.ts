import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { addNotification } from '../../notifications';
import { getRoomById } from '../../room_management';
import type {
  Booking,
  BookingStatus,
  CreateBookingInput,
} from '../model/booking';

const BOOKINGS_KEY = 'booking.records';
const ACTIVE_STATUSES: readonly BookingStatus[] = ['PENDING', 'APPROVED'];

export function toLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export async function getBookings(): Promise<Booking[]> {
  return readJson<Booking[]>(BOOKINGS_KEY, []);
}

export async function getBookingsForUser(username: string): Promise<Booking[]> {
  const bookings = await getBookings();
  return bookings
    .filter(booking => booking.requesterUsername === username)
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
}

export async function getBookingById(id: string): Promise<Booking | undefined> {
  const bookings = await getBookings();
  return bookings.find(booking => booking.id === id);
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function validateBooking(input: CreateBookingInput, bookings: Booking[]) {
  const room = getRoomById(input.roomId);
  if (!room || room.status !== 'AVAILABLE') {
    throw new Error('Phòng không tồn tại hoặc đang bảo trì.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error('Ngày phải có định dạng YYYY-MM-DD.');
  }
  if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    throw new Error('Giờ phải có định dạng HH:mm.');
  }

  const start = toLocalDateTime(input.date, input.startTime);
  const end = toLocalDateTime(input.date, input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error('Khoảng thời gian đặt phòng không hợp lệ.');
  }

  const dayDifference = Math.round(
    (startOfToday(start).getTime() - startOfToday(new Date()).getTime()) /
      86_400_000,
  );
  if (dayDifference < 1 || dayDifference > 3) {
    throw new Error('Chỉ được đặt trước từ 1 đến 3 ngày.');
  }

  const activeBookings = bookings.filter(booking =>
    ACTIVE_STATUSES.includes(booking.status),
  );
  const overlaps = (booking: Booking) => {
    if (booking.date !== input.date) {
      return false;
    }
    return input.startTime < booking.endTime && input.endTime > booking.startTime;
  };
  if (activeBookings.some(booking => booking.roomId === input.roomId && overlaps(booking))) {
    throw new Error('Phòng đã có yêu cầu khác trong khoảng thời gian này.');
  }
  if (
    activeBookings.some(
      booking => booking.requesterUsername === input.requesterUsername && overlaps(booking),
    )
  ) {
    throw new Error('Bạn đã có lịch đặt khác trùng thời gian.');
  }
  if (
    activeBookings.filter(
      booking => booking.requesterUsername === input.requesterUsername,
    ).length >= 2
  ) {
    throw new Error('Mỗi người chỉ có tối đa 2 yêu cầu đang chờ hoặc sắp dùng.');
  }
  if (!input.purpose.trim()) {
    throw new Error('Vui lòng nhập mục đích sử dụng phòng.');
  }
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const bookings = await getBookings();
  validateBooking(input, bookings);
  const booking: Booking = {
    ...input,
    purpose: input.purpose.trim(),
    id: `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  await writeJson(BOOKINGS_KEY, [...bookings, booking]);
  await addNotification(
    'admin',
    'Có yêu cầu đặt phòng mới',
    `${input.requesterUsername} yêu cầu đặt phòng ${getRoomById(input.roomId)?.name}.`,
  );
  return booking;
}

export async function updateBooking(
  id: string,
  update: (booking: Booking) => Booking,
): Promise<Booking> {
  const bookings = await getBookings();
  const index = bookings.findIndex(booking => booking.id === id);
  if (index < 0) {
    throw new Error('Không tìm thấy yêu cầu đặt phòng.');
  }
  const updated = update(bookings[index]);
  const next = [...bookings];
  next[index] = updated;
  await writeJson(BOOKINGS_KEY, next);
  return updated;
}

export async function reviewBooking(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  adminUsername: string,
): Promise<Booking> {
  const updated = await updateBooking(id, booking => {
    if (booking.status !== 'PENDING') {
      throw new Error('Yêu cầu này đã được xử lý.');
    }
    return {
      ...booking,
      status: decision,
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminUsername,
    };
  });
  await addNotification(
    updated.requesterUsername,
    decision === 'APPROVED' ? 'Yêu cầu đã được duyệt' : 'Yêu cầu bị từ chối',
    `Phòng ${getRoomById(updated.roomId)?.name}, ngày ${updated.date} lúc ${updated.startTime}.`,
  );
  return updated;
}

export async function cancelBooking(id: string, username: string): Promise<Booking> {
  const updated = await updateBooking(id, booking => {
    if (booking.requesterUsername !== username) {
      throw new Error('Bạn không có quyền hủy yêu cầu này.');
    }
    if (!ACTIVE_STATUSES.includes(booking.status)) {
      throw new Error('Yêu cầu này không thể hủy.');
    }
    return {
      ...booking,
      status: 'CANCELLED',
      temporaryPin: booking.temporaryPin
        ? { ...booking.temporaryPin, revokedAt: new Date().toISOString() }
        : undefined,
    };
  });
  await addNotification(
    'admin',
    'Yêu cầu đã được hủy',
    `${username} đã hủy yêu cầu phòng ${getRoomById(updated.roomId)?.name}.`,
  );
  return updated;
}
