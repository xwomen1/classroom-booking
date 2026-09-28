export const API_BASE_URL = 'http://192.168.121.22:8080';

export function isRemoteApiEnabled(): boolean {
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV;

  return nodeEnv !== 'test';
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
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ đặt phòng. Hãy kiểm tra Wi-Fi và dịch vụ Java.');
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
