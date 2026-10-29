/**
 * CÔNG TẮC CHẾ ĐỘ DỮ LIỆU CỦA APP.
 *
 * false: dùng dữ liệu local trong Async Storage, không cần booking-server.
 * true:  dùng REST API của booking-server tại REMOTE_API_BASE_URL.
 * Đổi cờ không tự đồng bộ dữ liệu giữa hai nơi lưu trữ.
 *
 * Điện thoại gọi server Java qua đường public. Máy chạy Java phải đang mở
 * và Cloudflare Tunnel phải trỏ về cổng 8080.
 */
export const ENABLE_REMOTE_SYNC = true;

export const REMOTE_API_BASE_URL =
  'https://dancing-shannon-johns-relaxation.trycloudflare.com';
