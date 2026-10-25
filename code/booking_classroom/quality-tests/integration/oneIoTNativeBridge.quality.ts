/// <reference types="node" />
/* eslint-env jest */
/**
 * Kiểm thử tích hợp giữa oneIoTClient và native module Android `OneIoTMqtt`.
 * Native module được thay bằng mock để kiểm tra đúng thứ tự tham số,
 * xử lý lỗi và luồng sự kiện MQTT mà không cần thiết bị thật.
 */
import { NativeModules, Platform } from 'react-native';
import {
  connectOneIoT,
  disconnectOneIoT,
  getOneIoTConnectionStatus,
  sendTemporaryPasswordToOneIoT,
} from '../../src/modules/smart_lock/services/oneIoTClient';
import { getManagedSmartLock } from '../../src/modules/smart_lock';
import { resetStorage } from '../support/testUtils';

const mockListeners = new Map<string, (event: unknown) => void>();

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => ({
  __esModule: true,
  default: class {
    addListener(name: string, listener: (event: unknown) => void) {
      mockListeners.set(name, listener);
      return { remove: () => mockListeners.delete(name) };
    }
  },
}));

const nativeMock = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  getStatus: jest.fn(),
  createTemporaryPassword: jest.fn(),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

const originalNodeEnv = process.env.NODE_ENV;

/**
 * Tắt nhánh "môi trường test" trong oneIoTClient để đi qua native module.
 * Lưu ý: khi đó isRemoteApiEnabled() cũng bật, nên mọi dữ liệu local cần
 * được đọc trước khi gọi hàm này.
 */
function useNativePath() {
  process.env.NODE_ENV = 'production';
}

beforeEach(async () => {
  await resetStorage();
  Object.values(nativeMock).forEach(fn => fn.mockReset());
  mockListeners.clear();
  jest.replaceProperty(Platform, 'OS', 'android');
  (NativeModules as Record<string, unknown>).OneIoTMqtt = nativeMock;
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  delete (NativeModules as Record<string, unknown>).OneIoTMqtt;
  jest.restoreAllMocks();
});

describe('connectOneIoT', () => {
  test('passes broker settings and the trimmed token to the native module', async () => {
    const lock = await getManagedSmartLock();
    nativeMock.connect.mockResolvedValue({ connected: true, broker: lock.oneIotBroker });

    const status = await connectOneIoT(lock, '  token-123  ');

    expect(status.connected).toBe(true);
    expect(nativeMock.connect).toHaveBeenCalledWith(
      lock.oneIotBroker, lock.oneIotPort, lock.toolDeviceId, 'token-123', lock.smartLockAeId, lock.oneIotCseId,
    );
  });

  test('rejects an empty token without touching the native module', async () => {
    await expect(connectOneIoT(await getManagedSmartLock(), '   ')).rejects.toThrow('Bạn chưa nhập token OneIoT của Tools.');
    expect(nativeMock.connect).not.toHaveBeenCalled();
  });

  test('wraps native failures with a helpful message', async () => {
    nativeMock.connect.mockRejectedValue(new Error('TLS handshake failed'));
    await expect(connectOneIoT(await getManagedSmartLock(), 'token'))
      .rejects.toThrow('Không kết nối được OneIoT. Hãy kiểm tra Internet, ID Tools và token. TLS handshake failed');
  });

  test('is unsupported outside Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await expect(connectOneIoT(await getManagedSmartLock(), 'token'))
      .rejects.toThrow('Kết nối OneIoT trực tiếp hiện chỉ được hỗ trợ trên Android.');
  });

  test('is unsupported when the native module is missing', async () => {
    delete (NativeModules as Record<string, unknown>).OneIoTMqtt;
    await expect(connectOneIoT(await getManagedSmartLock(), 'token'))
      .rejects.toThrow('chỉ được hỗ trợ trên Android');
  });
});

describe('status, disconnect and password commands', () => {
  test('in the Jest environment the client is offline and simulates commands', async () => {
    expect(await getOneIoTConnectionStatus()).toEqual({ connected: false });
    const result = await sendTemporaryPasswordToOneIoT(await getManagedSmartLock(), {
      roomId: 'r', roomName: '101', code: '1234567', passwordId: 9, startTime: 1, endTime: 2,
    });
    expect(result).toMatchObject({ accepted: true, requestId: 'test-9', passwordId: 9 });
    expect(nativeMock.createTemporaryPassword).not.toHaveBeenCalled();
  });

  test('getStatus and disconnect go through the native module', async () => {
    useNativePath();
    nativeMock.getStatus.mockResolvedValue({ connected: true });
    expect(await getOneIoTConnectionStatus()).toEqual({ connected: true });
    await disconnectOneIoT();
    expect(nativeMock.disconnect).toHaveBeenCalledTimes(1);
  });

  test('sends traitCreateTmpPasswordLock arguments in native order', async () => {
    const lock = await getManagedSmartLock();
    useNativePath();
    nativeMock.createTemporaryPassword.mockResolvedValue({
      accepted: true, trait: 'traitCreateTmpPasswordLock', requestId: 'req-1', passwordId: 3, publishedAt: 'now',
    });
    const command = { roomId: 'room-a101', roomName: '101', code: '7654321', passwordId: 3, startTime: 100, endTime: 200 };

    const result = await sendTemporaryPasswordToOneIoT(lock, command);

    expect(result.requestId).toBe('req-1');
    expect(nativeMock.createTemporaryPassword).toHaveBeenCalledWith(
      lock.oneIotCseId, lock.smartLockDeviceId, lock.smartLockDeviceName,
      'room-a101', '101', '7654321', 3, 100, 200,
    );
  });

  test('wraps native publish errors', async () => {
    const lock = await getManagedSmartLock();
    useNativePath();
    nativeMock.createTemporaryPassword.mockRejectedValue(new Error('not connected'));
    await expect(sendTemporaryPasswordToOneIoT(lock, {
      roomId: 'r', roomName: '101', code: '1', passwordId: 1, startTime: 1, endTime: 2,
    })).rejects.toThrow('Không gửi được mật khẩu tới SmartLock qua OneIoT. Hãy kết nối OneIoT trong Quản lý khóa trước. not connected');
  });
});

describe('MQTT event subscription', () => {
  test('forwards native SmartLock events until unsubscribed', async () => {
    useNativePath();
    const { subscribeOneIoTSmartLockMessages } = require('../../src/modules/smart_lock/services/oneIoTClient');
    const received: unknown[] = [];
    const unsubscribe = subscribeOneIoTSmartLockMessages((message: unknown) => received.push(message));

    const emit = mockListeners.get('OneIoTSmartLockEvent');
    expect(emit).toBeDefined();
    emit!({ topic: 't', payload: '{}', receivedAt: 'now' });
    unsubscribe();

    expect(received).toEqual([{ topic: 't', payload: '{}', receivedAt: 'now' }]);
    expect(mockListeners.has('OneIoTSmartLockEvent')).toBe(false);
  });

  test('is a no-op in the test environment', () => {
    const { subscribeOneIoTSmartLockMessages } = require('../../src/modules/smart_lock/services/oneIoTClient');
    const unsubscribe = subscribeOneIoTSmartLockMessages(jest.fn());
    expect(mockListeners.size).toBe(0);
    expect(() => unsubscribe()).not.toThrow();
  });
});
