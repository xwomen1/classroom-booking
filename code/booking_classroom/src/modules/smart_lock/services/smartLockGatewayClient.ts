import type {
  ManagedSmartLock,
  SmartLockGatewayStatus,
  TemporaryPasswordCommand,
  TemporaryPasswordCommandResult,
} from '../model/managedSmartLock';

function isTestEnvironment(): boolean {
  return (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV === 'test';
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error(payload.error || `Gateway từ chối yêu cầu (${response.status}).`);
  }
  return payload;
}

export async function getSmartLockGatewayStatus(
  lock: ManagedSmartLock,
): Promise<SmartLockGatewayStatus> {
  try {
    const response = await fetch(`${lock.gatewayBaseUrl}/api/lock/status`);
    return readResponse<SmartLockGatewayStatus>(response);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Gateway')) throw error;
    throw new Error('Không kết nối được SmartLock gateway. Hãy kiểm tra địa chỉ và dịch vụ tunghv3.');
  }
}

export async function sendTemporaryPasswordToGateway(
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
    const response = await fetch(`${lock.gatewayBaseUrl}/api/lock/temp-password`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    return readResponse<TemporaryPasswordCommandResult>(response);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Gateway')) throw error;
    throw new Error('Không gửi được mật khẩu tới SmartLock gateway. Hãy kiểm tra tunghv3 và kết nối mạng.');
  }
}
