import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { DEMO_ROOMS } from '../model/demoRooms';
import type { LockType, Room } from '../model/room';
import { assertAccountRole } from '../../auth/services/accountRepository';

const ROOMS_KEY = 'rooms.records';

export async function getRooms(): Promise<Room[]> {
  const stored = await readJson<Room[] | null>(ROOMS_KEY, null);
  if (stored) return stored;
  const seeded = DEMO_ROOMS.map(room => ({ ...room, equipment: [...room.equipment] }));
  await writeJson(ROOMS_KEY, seeded);
  return seeded;
}

export async function getRoomById(roomId: string): Promise<Room | undefined> {
  return (await getRooms()).find(room => room.id === roomId);
}

function normalizeRoom(input: {
  name: string;
  location: string;
  capacity: number;
  equipment: readonly string[];
  lockType: LockType;
  status: Room['status'];
}) {
  const name = input.name.trim().toUpperCase();
  const location = input.location.trim();
  const equipment = input.equipment.map(item => item.trim()).filter(Boolean);
  if (!name || !location) throw new Error('Tên và vị trí phòng không được để trống.');
  if (!Number.isInteger(input.capacity) || input.capacity < 1) throw new Error('Sức chứa phải là số nguyên dương.');
  return { ...input, name, location, equipment };
}

export async function createRoom(input: {
  name: string;
  location: string;
  capacity: number;
  equipment: readonly string[];
  lockType: LockType;
  status: Room['status'];
}, adminUsername: string): Promise<Room> {
  await assertAccountRole(adminUsername, 'admin');
  const rooms = await getRooms();
  const normalized = normalizeRoom(input);
  if (rooms.some(room => room.name.toLowerCase() === normalized.name.toLowerCase())) {
    throw new Error('Tên phòng đã tồn tại.');
  }
  const room: Room = {
    ...normalized,
    id: `room-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  await writeJson(ROOMS_KEY, [...rooms, room]);
  return room;
}

export async function updateRoom(id: string, input: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>, adminUsername: string): Promise<Room> {
  await assertAccountRole(adminUsername, 'admin');
  const rooms = await getRooms();
  const index = rooms.findIndex(room => room.id === id);
  if (index < 0) throw new Error('Không tìm thấy phòng.');
  const normalized = normalizeRoom(input);
  if (rooms.some(room => room.id !== id && room.name.toLowerCase() === normalized.name.toLowerCase())) {
    throw new Error('Tên phòng đã tồn tại.');
  }
  const updated: Room = { ...rooms[index], ...normalized, updatedAt: new Date().toISOString() };
  const next = [...rooms]; next[index] = updated;
  await writeJson(ROOMS_KEY, next);
  return updated;
}

export async function deleteRoom(id: string, adminUsername: string): Promise<void> {
  await assertAccountRole(adminUsername, 'admin');
  const rooms = await getRooms();
  if (!rooms.some(room => room.id === id)) throw new Error('Không tìm thấy phòng.');
  const bookings = await readJson<Array<{ roomId: string; status: string }>>('booking.records', []);
  if (bookings.some(item => item.roomId === id && ['PENDING', 'APPROVED'].includes(item.status))) {
    throw new Error('Phòng còn booking đang hoạt động nên chưa thể xóa.');
  }
  await writeJson(ROOMS_KEY, rooms.filter(room => room.id !== id));
}

export type RoomSearchFilters = {
  keyword?: string;
  minCapacity?: number;
  equipment?: string;
  lockType?: LockType | 'ALL';
};

export async function searchRooms(filters: RoomSearchFilters): Promise<Room[]> {
  const rooms = await getRooms();
  const keyword = filters.keyword?.trim().toLowerCase() ?? '';
  const equipment = filters.equipment?.trim().toLowerCase() ?? '';
  return rooms.filter(room =>
    room.status === 'AVAILABLE' &&
    (!keyword || `${room.name} ${room.location}`.toLowerCase().includes(keyword)) &&
    (!filters.minCapacity || room.capacity >= filters.minCapacity) &&
    (!equipment || room.equipment.some(item => item.toLowerCase().includes(equipment))) &&
    (!filters.lockType || filters.lockType === 'ALL' || room.lockType === filters.lockType),
  );
}
