import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { assertAccountRole } from '../../auth/services/accountRepository';
import { getRoomById } from '../../room_management/services/roomRepository';
import type { ManagedSmartLock } from '../model/managedSmartLock';

const SMART_LOCK_KEY = 'smartLock.primary';

const DEFAULT_SMART_LOCK: ManagedSmartLock = {
  id: 'primary-smart-lock',
  displayName: 'SmartLock DLWA12',
  model: 'DLWA12',
  aeId: 'S0a92253e-6f4b-472e-86a8-e25a3853cd11',
  deviceId: 'S3073a30b-e5c0-4370-a186-643ed93efb09',
  deviceName: 'SMARTLOCK_device_55132471',
  gatewayBaseUrl: 'http://192.168.0.133:8135',
  nextPasswordId: 1,
};

function normalizeGatewayBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(normalized)) {
    throw new Error('Địa chỉ gateway phải bắt đầu bằng http:// hoặc https://.');
  }
  return normalized;
}

export async function getManagedSmartLock(): Promise<ManagedSmartLock> {
  const stored = await readJson<Partial<ManagedSmartLock> | null>(SMART_LOCK_KEY, null);
  if (!stored) {
    await writeJson(SMART_LOCK_KEY, DEFAULT_SMART_LOCK);
    return { ...DEFAULT_SMART_LOCK };
  }
  const normalized: ManagedSmartLock = {
    ...DEFAULT_SMART_LOCK,
    ...stored,
    id: 'primary-smart-lock',
    nextPasswordId:
      Number.isInteger(stored.nextPasswordId) && Number(stored.nextPasswordId) >= 1
        ? Number(stored.nextPasswordId)
        : 1,
  };
  return normalized;
}

export async function configureSmartLockGateway(
  gatewayBaseUrl: string,
  adminUsername: string,
): Promise<ManagedSmartLock> {
  await assertAccountRole(adminUsername, 'admin');
  const lock = await getManagedSmartLock();
  const updated = {
    ...lock,
    gatewayBaseUrl: normalizeGatewayBaseUrl(gatewayBaseUrl),
  };
  await writeJson(SMART_LOCK_KEY, updated);
  return updated;
}

export async function assignSmartLockToRoom(
  roomId: string,
  adminUsername: string,
): Promise<ManagedSmartLock> {
  await assertAccountRole(adminUsername, 'admin');
  const room = await getRoomById(roomId);
  if (!room) throw new Error('Không tìm thấy phòng được chọn.');
  if (room.lockType !== 'PIN_CODE') {
    throw new Error('Chỉ được gắn SmartLock vào phòng sử dụng khóa mã số.');
  }
  const lock = await getManagedSmartLock();
  const updated: ManagedSmartLock = {
    ...lock,
    assignedRoomId: roomId,
    assignedAt: new Date().toISOString(),
    assignedBy: adminUsername,
  };
  await writeJson(SMART_LOCK_KEY, updated);
  return updated;
}

export async function unassignSmartLock(
  adminUsername: string,
): Promise<ManagedSmartLock> {
  await assertAccountRole(adminUsername, 'admin');
  const lock = await getManagedSmartLock();
  const updated: ManagedSmartLock = { ...lock };
  delete updated.assignedRoomId;
  delete updated.assignedAt;
  delete updated.assignedBy;
  await writeJson(SMART_LOCK_KEY, updated);
  return updated;
}

export async function getSmartLockForRoom(
  roomId: string,
): Promise<ManagedSmartLock | undefined> {
  const lock = await getManagedSmartLock();
  return lock.assignedRoomId === roomId ? lock : undefined;
}

export async function reserveSmartLockPasswordId(
  roomId: string,
): Promise<{ lock: ManagedSmartLock; passwordId: number }> {
  const lock = await getSmartLockForRoom(roomId);
  if (!lock) {
    throw new Error('Phòng chưa được gắn với SmartLock đang quản lý.');
  }
  const passwordId = Math.min(255, Math.max(1, lock.nextPasswordId));
  const updated: ManagedSmartLock = {
    ...lock,
    nextPasswordId: passwordId >= 255 ? 1 : passwordId + 1,
  };
  await writeJson(SMART_LOCK_KEY, updated);
  return { lock: updated, passwordId };
}
