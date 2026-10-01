import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type {
  ManagedSmartLock,
  OneIoTConnectionStatus,
  TemporaryPasswordCommand,
  TemporaryPasswordCommandResult,
} from '../model/managedSmartLock';

type OneIoTMqttNativeModule = {
  connect(
    broker: string,
    port: number,
    toolDeviceId: string,
    token: string,
    smartLockAeId: string,
    cseId: string,
  ): Promise<OneIoTConnectionStatus>;
  disconnect(): Promise<void>;
  getStatus(): Promise<OneIoTConnectionStatus>;
  createTemporaryPassword(
    cseId: string,
    smartLockDeviceId: string,
    smartLockDeviceName: string,
    roomId: string,
    roomName: string,
    code: string,
    passwordId: number,
    startTime: number,
    endTime: number,
  ): Promise<TemporaryPasswordCommandResult>;
};

export type OneIoTSmartLockMessage = {
  topic: string;
  payload: string;
  receivedAt: string;
};

function isTestEnvironment(): boolean {
  return (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV === 'test';
}

function nativeModule(): OneIoTMqttNativeModule {
  const module = NativeModules.OneIoTMqtt as OneIoTMqttNativeModule | undefined;
  if (Platform.OS !== 'android' || !module) {
    throw new Error('Kết nối OneIoT trực tiếp hiện chỉ được hỗ trợ trên Android.');
  }
  return module;
}

function explainConnectionError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(
    `Không kết nối được OneIoT. Hãy kiểm tra Internet, ID Tools và token. ${detail}`,
  );
}

export async function connectOneIoT(
  lock: ManagedSmartLock,
  token: string,
): Promise<OneIoTConnectionStatus> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error('Bạn chưa nhập token OneIoT của Tools.');
  }
  try {
    return await nativeModule().connect(
      lock.oneIotBroker,
      lock.oneIotPort,
      lock.toolDeviceId,
      normalizedToken,
      lock.smartLockAeId,
      lock.oneIotCseId,
    );
  } catch (error) {
    throw explainConnectionError(error);
  }
}

export function subscribeOneIoTSmartLockMessages(
  listener: (message: OneIoTSmartLockMessage) => void,
): () => void {
  if (isTestEnvironment() || Platform.OS !== 'android' || !NativeModules.OneIoTMqtt) {
    return () => {};
  }
  const emitter = new NativeEventEmitter(NativeModules.OneIoTMqtt);
  const subscription = emitter.addListener('OneIoTSmartLockEvent', listener);
  return () => subscription.remove();
}

export async function disconnectOneIoT(): Promise<void> {
  if (isTestEnvironment() || Platform.OS !== 'android' || !NativeModules.OneIoTMqtt) {
    return;
  }
  await nativeModule().disconnect();
}

export async function getOneIoTConnectionStatus(): Promise<OneIoTConnectionStatus> {
  if (isTestEnvironment()) return { connected: false };
  return nativeModule().getStatus();
}

export async function sendTemporaryPasswordToOneIoT(
  lock: ManagedSmartLock,
  command: TemporaryPasswordCommand,
): Promise<TemporaryPasswordCommandResult> {
  if (isTestEnvironment()) {
    return {
      accepted: true,
      trait: 'traitCreateTmpPasswordLock',
      requestId: `test-${command.passwordId}`,
      passwordId: command.passwordId,
      publishedAt: new Date().toISOString(),
    };
  }
  try {
    return await nativeModule().createTemporaryPassword(
      lock.oneIotCseId,
      lock.smartLockDeviceId,
      lock.smartLockDeviceName,
      command.roomId,
      command.roomName,
      command.code,
      command.passwordId,
      command.startTime,
      command.endTime,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Không gửi được mật khẩu tới SmartLock qua OneIoT. Hãy kết nối OneIoT trong Quản lý khóa trước. ${detail}`,
    );
  }
}
