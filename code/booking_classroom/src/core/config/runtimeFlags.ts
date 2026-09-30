/**
 * CÔNG TẮC CHẾ ĐỘ DỮ LIỆU CỦA APP.
 *
 * false: chạy hoàn toàn local bằng Async Storage (chế độ hiện tại).
 * true:  bật đồng bộ qua booking-server; đồng thời sửa REMOTE_API_BASE_URL
 *        thành địa chỉ LAN của máy đang chạy server.
 */
export const ENABLE_REMOTE_SYNC = false;

export const REMOTE_API_BASE_URL = 'http://192.168.121.22:8080';
