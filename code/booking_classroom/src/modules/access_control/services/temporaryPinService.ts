import type { Booking } from '../../booking/model/booking';
import {
  getBookingById,
  toLocalDateTime,
  updateBooking,
} from '../../booking/services/bookingRepository';
import { addNotification } from '../../notifications';
import { getRoomById } from '../../room_management';
import type { UserRole } from '../../../core/types/userRole';

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function generateSixDigitPin(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export async function createTemporaryPin(
  bookingId: string,
  actorUsername: string,
  actorRole: UserRole,
): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error('Không tìm thấy yêu cầu đặt phòng.');
  }
  if (booking.status !== 'APPROVED') {
    throw new Error('Chỉ tạo mã cho yêu cầu đã được duyệt.');
  }
  const room = getRoomById(booking.roomId);
  if (!room || room.lockType !== 'PIN_CODE') {
    throw new Error('Phòng này không sử dụng khóa mã số.');
  }
  if (booking.temporaryPin && !booking.temporaryPin.revokedAt) {
    throw new Error('Booking đã có mã tạm thời.');
  }
  if (
    actorRole === 'user' &&
    (booking.requesterUsername !== actorUsername || !booking.userCanGeneratePin)
  ) {
    throw new Error('User chưa được Admin cho phép tạo mã.');
  }

  const start = toLocalDateTime(booking.date, booking.startTime);
  const end = toLocalDateTime(booking.date, booking.endTime);
  const updated = await updateBooking(bookingId, current => ({
    ...current,
    temporaryPin: {
      code: generateSixDigitPin(),
      createdAt: new Date().toISOString(),
      createdBy: actorUsername,
      validFrom: addMinutes(start, -10).toISOString(),
      validUntil: addMinutes(end, 10).toISOString(),
    },
  }));

  await addNotification(
    updated.requesterUsername,
    'Đã cấp mã mở cửa tạm thời',
    `Mã cho phòng ${room.name} đã sẵn sàng trong chi tiết booking.`,
  );
  return updated;
}

export async function grantUserPinPermission(
  bookingId: string,
  adminUsername: string,
): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error('Không tìm thấy yêu cầu đặt phòng.');
  }
  if (booking.status !== 'APPROVED') {
    throw new Error('Chỉ cấp quyền cho yêu cầu đã được duyệt.');
  }
  const room = getRoomById(booking.roomId);
  if (!room || room.lockType !== 'PIN_CODE') {
    throw new Error('Phòng này không sử dụng khóa mã số.');
  }
  if (booking.temporaryPin && !booking.temporaryPin.revokedAt) {
    throw new Error('Booking đã có mã tạm thời.');
  }

  const updated = await updateBooking(bookingId, current => ({
    ...current,
    userCanGeneratePin: true,
  }));
  await addNotification(
    updated.requesterUsername,
    'Bạn được phép tạo mã mở cửa',
    `Admin ${adminUsername} đã cho phép bạn tự tạo mã cho phòng ${room.name}.`,
  );
  return updated;
}

export type PinDisplayStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export function getPinDisplayStatus(
  booking: Booking,
  now = new Date(),
): PinDisplayStatus | null {
  const pin = booking.temporaryPin;
  if (!pin) {
    return null;
  }
  if (pin.revokedAt || booking.status === 'CANCELLED') {
    return 'REVOKED';
  }
  if (now < new Date(pin.validFrom)) {
    return 'PENDING';
  }
  if (now > new Date(pin.validUntil)) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}
