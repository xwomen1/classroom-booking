import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { apiRequest, isRemoteApiEnabled } from '../../../core/api/client';
import { assertAccountRole } from '../../auth/services/accountRepository';
import { getRoomById } from '../../room_management/services/roomRepository';
import type { ManagedSmartLock } from '../model/managedSmartLock';

const SMART_LOCK_KEY = 'smartLock.primary';

const LEGACY_SMART_LOCK_AE_IDS = new Set([
  'S0a92253e-6f4b-472e-86a8-e25a3853cd11',
]);
const LEGACY_SMART_LOCK_DEVICE_IDS = new Set([
  'S3073a30b-e5c0-4370-a186-643ed93efb09',
]);
const LEGACY_SMART_LOCK_DEVICE_NAMES = new Set([
  'SMARTLOCK_device_55132471',
]);
const LEGACY_TOOL_DEVICE_IDS = new Set([
  'S0a92253e-6f4b-472e-86a8-e25a3853cd11',
]);

const DEFAULT_SMART_LOCK: ManagedSmartLock = {
  id: 'primary-smart-lock',
  displayName: 'SmartLock DLWA12',
  model: 'DLWA12',
  smartLockAeId: 'Sdd6f3763-b655-43ad-87d0-3862be2a1201',
  smartLockDeviceId: 'Sdd6f3763-b655-43ad-87d0-3862be2a1201',
  smartLockDeviceName: 'smartlock_0001',
  oneIotBroker: 'oneiot.com.vn',
  oneIotPort: 2111,
  oneIotCseId: '/in-cse',
  toolDeviceId: 'Sf391c192-3997-4e6c-a31b-abffac140b4c',
  nextPasswordId: 1,
};

export async function getManagedSmartLock(): Promise<ManagedSmartLock> {
  if (isRemoteApiEnabled()) {
    return apiRequest<ManagedSmartLock>('/api/smart-lock');
  }
  const stored = await readJson<Partial<ManagedSmartLock> | null>(SMART_LOCK_KEY, null);
  if (!stored) {
    await writeJson(SMART_LOCK_KEY, DEFAULT_SMART_LOCK);
    return { ...DEFAULT_SMART_LOCK };
  }
  const legacy = stored as Partial<ManagedSmartLock> & {
    aeId?: string;
    deviceId?: string;
    deviceName?: string;
  };
  const storedAeId = stored.smartLockAeId ?? legacy.aeId;
  const storedDeviceId = stored.smartLockDeviceId ?? legacy.deviceId;
  const storedDeviceName = stored.smartLockDeviceName ?? legacy.deviceName;
  const storedToolDeviceId = stored.toolDeviceId;
  const normalized: ManagedSmartLock = {
    ...DEFAULT_SMART_LOCK,
    id: 'primary-smart-lock',
    displayName: stored.displayName ?? DEFAULT_SMART_LOCK.displayName,
    model: stored.model ?? DEFAULT_SMART_LOCK.model,
    smartLockAeId:
      !storedAeId || LEGACY_SMART_LOCK_AE_IDS.has(storedAeId)
        ? DEFAULT_SMART_LOCK.smartLockAeId
        : storedAeId,
    smartLockDeviceId:
      !storedDeviceId || LEGACY_SMART_LOCK_DEVICE_IDS.has(storedDeviceId)
        ? DEFAULT_SMART_LOCK.smartLockDeviceId
        : storedDeviceId,
    smartLockDeviceName:
      !storedDeviceName || LEGACY_SMART_LOCK_DEVICE_NAMES.has(storedDeviceName)
        ? DEFAULT_SMART_LOCK.smartLockDeviceName
        : storedDeviceName,
    oneIotBroker: stored.oneIotBroker ?? DEFAULT_SMART_LOCK.oneIotBroker,
    oneIotPort: stored.oneIotPort ?? DEFAULT_SMART_LOCK.oneIotPort,
    oneIotCseId: stored.oneIotCseId ?? DEFAULT_SMART_LOCK.oneIotCseId,
    toolDeviceId:
      !storedToolDeviceId || LEGACY_TOOL_DEVICE_IDS.has(storedToolDeviceId)
        ? DEFAULT_SMART_LOCK.toolDeviceId
        : storedToolDeviceId,
    assignedRoomId: stored.assignedRoomId,
    assignedAt: stored.assignedAt,
    assignedBy: stored.assignedBy,
    nextPasswordId:
      Number.isInteger(stored.nextPasswordId) && Number(stored.nextPasswordId) >= 1
        ? Number(stored.nextPasswordId)
        : 1,
  };
  if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
    await writeJson(SMART_LOCK_KEY, normalized);
  }
  return normalized;
}

export async function assignSmartLockToRoom(
  roomId: string,
  adminUsername: string,
): Promise<ManagedSmartLock> {
  if (isRemoteApiEnabled()) {
    return apiRequest<ManagedSmartLock>('/api/smart-lock/assign', {
      method: 'POST', body: { roomId },
    });
  }
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
  if (isRemoteApiEnabled()) {
    return apiRequest<ManagedSmartLock>('/api/smart-lock/unassign', { method: 'POST' });
  }
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
  if (isRemoteApiEnabled()) {
    return apiRequest<{ lock: ManagedSmartLock; passwordId: number }>(
      '/api/smart-lock/reserve-password-id',
      { method: 'POST', body: { roomId } },
    );
  }
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
