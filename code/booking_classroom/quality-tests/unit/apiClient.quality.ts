/* eslint-env jest */
import {
  API_BASE_URL,
  apiRequest,
  clearApiSession,
  isRemoteApiEnabled,
  setApiToken,
} from '../../src/core/api/client';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit]>;

function jsonResponse(status: number, body: unknown): Response {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as Response;
}

describe('core/api/client – apiRequest', () => {
  let fetchMock: FetchMock;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    clearApiSession();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('remote sync is always disabled while running under Jest', () => {
    expect(isRemoteApiEnabled()).toBe(false);
  });

  test('joins the base URL and path without duplicating slashes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await apiRequest('/api/rooms');
    await apiRequest('api/rooms');

    const base = API_BASE_URL.replace(/\/+$/, '');
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/rooms`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${base}/api/rooms`);
  });

  test('sends JSON headers, method and serialized body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'x' }));

    const result = await apiRequest<{ id: string }>('/api/rooms', {
      method: 'POST',
      body: { name: '101' },
    });

    expect(result).toEqual({ id: 'x' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: '101' }));
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  test('defaults to GET without a body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiRequest('/api/bookings');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  test('attaches the bearer token after setApiToken and removes it after clearApiSession', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    setApiToken('secret-token');
    await apiRequest('/api/bookings');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer secret-token' });

    clearApiSession();
    await apiRequest('/api/bookings');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
  });

  test('returns undefined for HTTP 204', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' } as Response);
    await expect(apiRequest('/api/rooms/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  test('returns an empty object when a 200 response has no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, undefined));
    await expect(apiRequest('/api/notifications/read', { method: 'POST' })).resolves.toEqual({});
  });

  test('uses the server message for an error response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'Phòng đã có yêu cầu khác.' }));
    await expect(apiRequest('/api/bookings', { method: 'POST' })).rejects.toThrow('Phòng đã có yêu cầu khác.');
  });

  test('falls back to a generic message when the error body has no message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, {}));
    await expect(apiRequest('/api/accounts')).rejects.toThrow('Máy chủ từ chối yêu cầu (HTTP 403).');
  });

  test('HTTP 401 clears the stored token', async () => {
    setApiToken('expired');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Phiên đăng nhập đã hết hạn.' }))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await expect(apiRequest('/api/bookings')).rejects.toThrow('Phiên đăng nhập đã hết hạn.');
    await apiRequest('/api/bookings');

    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
  });

  test('reports malformed JSON differently for success and error responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, '<html>'));
    await expect(apiRequest('/api/rooms')).rejects.toThrow('Máy chủ trả về dữ liệu không đúng định dạng JSON.');

    fetchMock.mockResolvedValueOnce(jsonResponse(502, '<html>Bad gateway</html>'));
    await expect(apiRequest('/api/rooms')).rejects.toThrow('Máy chủ trả về lỗi HTTP 502 không đúng định dạng.');
  });

  test('translates network failures into a connection message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiRequest('/api/rooms')).rejects.toThrow(
      'Không kết nối được máy chủ đặt phòng. Hãy kiểm tra địa chỉ và trạng thái server.',
    );
  });

  test('aborts the request after 12 seconds', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));

    const pending = apiRequest('/api/rooms');
    jest.advanceTimersByTime(12_000);
    await expect(pending).rejects.toThrow('Máy chủ đặt phòng không phản hồi trong 12 giây.');
  });
});
