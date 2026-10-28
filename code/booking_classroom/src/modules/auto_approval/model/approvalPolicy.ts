import type { AppConfiguration } from '../../configuration/model/appConfiguration';
import type { Room } from '../../room_management/model/room';

/** Tên hiển thị ở `reviewedBy` / `grantedBy` khi hệ thống tự duyệt. */
export const AUTO_APPROVER = 'system';

export type ApprovalMode = 'AUTO' | 'MANUAL';

export function isSpecialRoom(room: Pick<Room, 'requiresApproval'>): boolean {
  return room.requiresApproval === true;
}

/**
 * Quyết định cách xử lý một yêu cầu mới:
 * - công tắc chung tắt → MANUAL (giữ nguyên luồng admin duyệt như trước);
 * - phòng đặc biệt → MANUAL;
 * - còn lại → AUTO.
 * Mọi luật đặt phòng (trùng lịch, bảo trì, giới hạn...) đã được kiểm tra trước bước này.
 */
export function getApprovalMode(
  room: Pick<Room, 'requiresApproval'>,
  configuration: Pick<AppConfiguration, 'autoApprovalEnabled'>,
): ApprovalMode {
  if (!configuration.autoApprovalEnabled) return 'MANUAL';
  return isSpecialRoom(room) ? 'MANUAL' : 'AUTO';
}
