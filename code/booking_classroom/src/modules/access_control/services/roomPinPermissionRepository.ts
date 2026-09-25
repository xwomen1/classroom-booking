import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { assertAccountRole } from '../../auth/services/accountRepository';
import { addNotification } from '../../notifications';
import { getRoomById } from '../../room_management/services/roomRepository';
import type { RoomPinPermission } from '../model/roomPinPermission';

const PERMISSIONS_KEY = 'access.roomPinPermissions';

export async function getRoomPinPermissions(): Promise<RoomPinPermission[]> {
  return readJson<RoomPinPermission[]>(PERMISSIONS_KEY, []);
}

export async function hasRoomPinPermission(username: string, roomId: string): Promise<boolean> {
  return (await getRoomPinPermissions()).some(
    item => item.username === username && item.roomId === roomId && item.active,
  );
}

export async function grantRoomPinPermission(
  username: string,
  roomId: string,
  adminUsername: string,
): Promise<RoomPinPermission> {
  await assertAccountRole(adminUsername, 'admin');
  const room = await getRoomById(roomId);
  if (!room || room.lockType !== 'PIN_CODE') {
    throw new Error('Chỉ cấp quyền tự tạo mã cho phòng dùng khóa mã số.');
  }
  const permissions = await getRoomPinPermissions();
  const index = permissions.findIndex(item => item.username === username && item.roomId === roomId);
  const permission: RoomPinPermission = {
    id: index >= 0 ? permissions[index].id : `room-pin-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    username,
    roomId,
    grantedAt: new Date().toISOString(),
    grantedBy: adminUsername,
    active: true,
  };
  const next = [...permissions];
  if (index >= 0) next[index] = permission;
  else next.push(permission);
  await writeJson(PERMISSIONS_KEY, next);
  return permission;
}

export async function revokeRoomPinPermission(
  username: string,
  roomId: string,
  adminUsername: string,
): Promise<RoomPinPermission> {
  await assertAccountRole(adminUsername, 'admin');
  const permissions = await getRoomPinPermissions();
  const index = permissions.findIndex(
    item => item.username === username && item.roomId === roomId && item.active,
  );
  if (index < 0) throw new Error('Người dùng không có quyền đang hoạt động tại phòng này.');
  const updated: RoomPinPermission = {
    ...permissions[index],
    active: false,
    revokedAt: new Date().toISOString(),
    revokedBy: adminUsername,
  };
  const next = [...permissions];
  next[index] = updated;
  await writeJson(PERMISSIONS_KEY, next);
  const room = await getRoomById(roomId);
  await addNotification(
    username,
    'Đã thu hồi quyền tự tạo mã',
    `Quyền tự tạo mật khẩu tạm thời của phòng ${room?.name ?? roomId} đã bị thu hồi.`,
  );
  return updated;
}
