export const API_BASE_URL = 'https://dancing-shannon-johns-relaxation.trycloudflare.com';

export function useRemoteApi(): boolean {
  return process.env.NODE_ENV !== 'test';
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
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Pinggy-No-Screen': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ đặt phòng. Hãy kiểm tra đường link public còn mở.');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & ErrorBody) : ({} as T & ErrorBody);
  if (!response.ok) {
    throw new Error(payload.message || 'Máy chủ từ chối yêu cầu.');
  }
  return payload;
}
