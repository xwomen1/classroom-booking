/**
 * CÔNG TẮC CHẾ ĐỘ DỮ LIỆU CỦA APP.
 *
 * false: chạy hoàn toàn local bằng Async Storage (chế độ hiện tại).
 * true:  bật đồng bộ qua booking-server tại REMOTE_API_BASE_URL.
 *
 * URL mặc định trỏ tới server phát triển trên máy tính. Với điện thoại thật,
 * chạy `adb reverse tcp:8080 tcp:8080` trước khi mở app ở chế độ remote.
 */
export const ENABLE_REMOTE_SYNC = false;

export const REMOTE_API_BASE_URL =
  'http://127.0.0.1:8080';
