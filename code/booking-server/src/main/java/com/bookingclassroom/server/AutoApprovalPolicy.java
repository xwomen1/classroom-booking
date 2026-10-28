package com.bookingclassroom.server;

/**
 * Quy tắc tự động duyệt yêu cầu đặt phòng (khớp với module auto_approval của app).
 *
 * <ul>
 *   <li>Công tắc chung {@code autoApprovalEnabled} tắt: mọi yêu cầu chờ admin như trước.
 *   <li>Phòng đặc biệt ({@code requiresApproval = true}): luôn chờ admin duyệt.
 *   <li>Còn lại: được duyệt ngay khi tạo, sau khi đã qua mọi luật đặt phòng.
 * </ul>
 */
final class AutoApprovalPolicy {
  /** Giá trị ghi vào {@code reviewedBy} / {@code grantedBy} khi hệ thống tự duyệt. */
  static final String SYSTEM_REVIEWER = "system";

  private AutoApprovalPolicy() {}

  static boolean isSpecialRoom(Domain.Room room) {
    return room != null && Boolean.TRUE.equals(room.requiresApproval);
  }

  static boolean shouldAutoApprove(Domain.Configuration configuration, Domain.Room room) {
    if (configuration == null || !Boolean.TRUE.equals(configuration.autoApprovalEnabled)) {
      return false;
    }
    return room != null && !isSpecialRoom(room);
  }
}
