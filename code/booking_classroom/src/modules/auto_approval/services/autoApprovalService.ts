import { storeRoomPinPermission } from '../../access_control/services/roomPinPermissionRepository';
import { getConfiguration } from '../../configuration/services/configurationRepository';
import { addNotification } from '../../notifications';
import type { Booking } from '../../booking/model/booking';
import type { Room } from '../../room_management/model/room';
import { AUTO_APPROVER, getApprovalMode, type ApprovalMode } from '../model/approvalPolicy';

export async function resolveApprovalMode(room: Room): Promise<ApprovalMode> {
  return getApprovalMode(room, await getConfiguration());
}

/** Trường gắn vào booking mới khi được tự động duyệt. */
export function autoApprovalFields(now: Date = new Date()): Pick<Booking, 'status' | 'reviewedAt' | 'reviewedBy' | 'autoApproved'> {
  return {
    status: 'APPROVED',
    reviewedAt: now.toISOString(),
    reviewedBy: AUTO_APPROVER,
    autoApproved: true,
  };
}

/**
 * Hoàn tất các bước sau duyệt cho những booking vừa được tự động duyệt
 * (đã lưu với status APPROVED): cấp quyền tự tạo mã cho phòng khóa số,
 * thông báo cho người đặt và cho admin.
 */
export async function completeAutoApproval(bookings: readonly Booking[], room: Room): Promise<void> {
  if (bookings.length === 0) return;
  const [first] = bookings;
  if (room.lockType === 'PIN_CODE') {
    await storeRoomPinPermission(first.requesterUsername, room.id, AUTO_APPROVER);
  }
  const occurrences = bookings.length > 1 ? ` và ${bookings.length - 1} lịch lặp lại` : '';
  await addNotification(
    first.requesterUsername,
    'Yêu cầu đã được tự động duyệt',
    `Phòng ${room.name}, ngày ${first.date} lúc ${first.startTime}${occurrences}.`,
    'positive',
  );
  await addNotification(
    'admin',
    'Đặt phòng được tự động duyệt',
    `${first.requesterUsername} đã đặt phòng ${room.name}${occurrences}.`,
    'neutral',
  );
}
