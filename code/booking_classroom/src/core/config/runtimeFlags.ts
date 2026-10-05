/**
 * CÔNG TẮC CHẾ ĐỘ DỮ LIỆU CỦA APP.
 *
 * false: chạy hoàn toàn local bằng Async Storage (chế độ hiện tại).
 * true:  bật đồng bộ qua booking-server tại REMOTE_API_BASE_URL.
 *
 * Điện thoại gọi server Java qua đường public. Máy chạy Java phải đang mở
 * và Cloudflare Tunnel phải trỏ về cổng 8080.
 */
export const ENABLE_REMOTE_SYNC = true;

export const REMOTE_API_BASE_URL =
  'https://dancing-shannon-johns-relaxation.trycloudflare.com';
