import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { assertAccountRole } from '../../auth/services/accountRepository';
import { getRoomById } from '../../room_management/services/roomRepository';
import type { ManagedSmartLock } from '../model/managedSmartLock';

const SMART_LOCK_KEY = 'smartLock.primary';

const DEFAULT_SMART_LOCK: ManagedSmartLock = {
  id: 'primary-smart-lock',
  displayName: 'SmartLock DLWA12',
  model: 'DLWA12',
  smartLockAeId: 'S0a92253e-6f4b-472e-86a8-e25a3853cd11',
  smartLockDeviceId: 'S3073a30b-e5c0-4370-a186-643ed93efb09',
  smartLockDeviceName: 'SMARTLOCK_device_55132471',
  oneIotBroker: 'oneiot.com.vn',
  oneIotPort: 2111,
  oneIotCseId: '/in-cse',
  toolDeviceId: 'S0a92253e-6f4b-472e-86a8-e25a3853cd11',
  nextPasswordId: 1,
};

export async function getManagedSmartLock(): Promise<ManagedSmartLock> {
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
  const normalized: ManagedSmartLock = {
    ...DEFAULT_SMART_LOCK,
    id: 'primary-smart-lock',
    displayName: stored.displayName ?? DEFAULT_SMART_LOCK.displayName,
    model: stored.model ?? DEFAULT_SMART_LOCK.model,
    smartLockAeId:
      stored.smartLockAeId ?? legacy.aeId ?? DEFAULT_SMART_LOCK.smartLockAeId,
    smartLockDeviceId:
      stored.smartLockDeviceId ?? legacy.deviceId ?? DEFAULT_SMART_LOCK.smartLockDeviceId,
    smartLockDeviceName:
      stored.smartLockDeviceName ?? legacy.deviceName ?? DEFAULT_SMART_LOCK.smartLockDeviceName,
    oneIotBroker: stored.oneIotBroker ?? DEFAULT_SMART_LOCK.oneIotBroker,
    oneIotPort: stored.oneIotPort ?? DEFAULT_SMART_LOCK.oneIotPort,
    oneIotCseId: stored.oneIotCseId ?? DEFAULT_SMART_LOCK.oneIotCseId,
    toolDeviceId: stored.toolDeviceId ?? DEFAULT_SMART_LOCK.toolDeviceId,
    assignedRoomId: stored.assignedRoomId,
    assignedAt: stored.assignedAt,
    assignedBy: stored.assignedBy,
    nextPasswordId:
      Number.isInteger(stored.nextPasswordId) && Number(stored.nextPasswordId) >= 1
        ? Number(stored.nextPasswordId)
        : 1,
  };
  return normalized;
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
