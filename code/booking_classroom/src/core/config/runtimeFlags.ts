/**
 * CÔNG TẮC CHẾ ĐỘ DỮ LIỆU CỦA APP.
 *
 * false: chạy hoàn toàn local bằng Async Storage (chế độ hiện tại).
 * true:  bật đồng bộ qua booking-server tại REMOTE_API_BASE_URL.
 *
 * URL public mới nhất từ nhánh syncdata được giữ bên dưới nhưng không được gọi
 * khi ENABLE_REMOTE_SYNC = false.
 */
export const ENABLE_REMOTE_SYNC = false;

export const REMOTE_API_BASE_URL =
  'https://dancing-shannon-johns-relaxation.trycloudflare.com';
