import {
  ENABLE_REMOTE_SYNC,
  REMOTE_API_BASE_URL,
} from '../config/runtimeFlags';

export const API_BASE_URL = REMOTE_API_BASE_URL;
const REQUEST_TIMEOUT_MS = 12_000;

export function isRemoteApiEnabled(): boolean {
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV;

  return ENABLE_REMOTE_SYNC && nodeEnv !== 'test';
}

let token: string | null = null;

export function setApiToken(value: string | null) {
  token = value;
}

export function clearApiSession() {
  token = null;
}

type ErrorBody = { message?: string };

export async function apiRequest<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const baseUrl = API_BASE_URL.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw new Error('Địa chỉ máy chủ đặt phòng không hợp lệ.');
    }
    response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      method: options?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Địa chỉ máy chủ đặt phòng không hợp lệ.') throw error;
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new Error(timedOut
      ? 'Máy chủ đặt phòng không phản hồi trong 12 giây.'
      : 'Không kết nối được máy chủ đặt phòng. Hãy kiểm tra địa chỉ và trạng thái server.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  let payload: T & ErrorBody;
  try {
    payload = text ? (JSON.parse(text) as T & ErrorBody) : ({} as T & ErrorBody);
  } catch {
    throw new Error(response.ok
      ? 'Máy chủ trả về dữ liệu không đúng định dạng JSON.'
      : `Máy chủ trả về lỗi HTTP ${response.status} không đúng định dạng.`);
  }
  if (!response.ok) {
    if (response.status === 401) clearApiSession();
    throw new Error(payload.message || `Máy chủ từ chối yêu cầu (HTTP ${response.status}).`);
  }
  return payload;
}
