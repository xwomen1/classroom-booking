import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { assertAccountRole } from '../../auth/services/accountRepository';
import { DEMO_ROOMS } from '../model/demoRooms';
import type { LockType, Room } from '../model/room';

const ROOMS_KEY = 'rooms.records';

function inferFloor(room: Omit<Room, 'floor'> & { floor?: number }): number {
  if (room.floor && room.floor >= 1 && room.floor <= 8) return room.floor;
  return Number(room.location.match(/(?:Tầng|tầng)\s*(\d+)/i)?.[1]) || 1;
}

export async function getRooms(): Promise<Room[]> {
  const stored = await readJson<Array<Omit<Room, 'floor'> & { floor?: number }> | null>(ROOMS_KEY, null);
  if (stored) {
    const normalized = stored.map(room => ({ ...room, floor: inferFloor(room) }));
    const ids = new Set(normalized.map(room => room.id));
    const merged = [
      ...normalized,
      ...DEMO_ROOMS.filter(room => !ids.has(room.id)).map(room => ({ ...room, equipment: [...room.equipment] })),
    ];
    if (merged.length !== stored.length || stored.some(room => room.floor === undefined)) {
      await writeJson(ROOMS_KEY, merged);
    }
    return merged;
  }
  const seeded = DEMO_ROOMS.map(room => ({ ...room, equipment: [...room.equipment] }));
  await writeJson(ROOMS_KEY, seeded);
  return seeded;
}

export async function getRoomById(roomId: string): Promise<Room | undefined> {
  return (await getRooms()).find(room => room.id === roomId);
}

type RoomInput = {
  name: string;
  floor: number;
  location: string;
  capacity: number;
  equipment: readonly string[];
  lockType: LockType;
  status: Room['status'];
};

function normalizeRoom(input: RoomInput): RoomInput {
  const name = input.name.trim().toUpperCase();
  const location = input.location.trim() || `Tầng ${input.floor}, tòa nhà A`;
  const equipment = input.equipment.map(item => item.trim()).filter(Boolean);
  if (!name) throw new Error('Tên phòng không được để trống.');
  if (!Number.isInteger(input.floor) || input.floor < 1 || input.floor > 8) {
    throw new Error('Tầng phải nằm trong khoảng 1 đến 8.');
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new Error('Sức chứa phải là số nguyên dương.');
  }
  return { ...input, name, location, equipment };
}

export async function createRoom(input: RoomInput, adminUsername: string): Promise<Room> {
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

export async function updateRoom(
  id: string,
  input: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>,
  adminUsername: string,
): Promise<Room> {
  await assertAccountRole(adminUsername, 'admin');
  const rooms = await getRooms();
  const index = rooms.findIndex(room => room.id === id);
  if (index < 0) throw new Error('Không tìm thấy phòng.');
  const normalized = normalizeRoom(input);
  if (rooms.some(room => room.id !== id && room.name.toLowerCase() === normalized.name.toLowerCase())) {
    throw new Error('Tên phòng đã tồn tại.');
  }
  const updated: Room = { ...rooms[index], ...normalized, updatedAt: new Date().toISOString() };
  const next = [...rooms];
  next[index] = updated;
  await writeJson(ROOMS_KEY, next);
  return updated;
}

export async function deleteRoom(id: string, adminUsername: string): Promise<void> {
  await assertAccountRole(adminUsername, 'admin');
  const rooms = await getRooms();
  if (!rooms.some(room => room.id === id)) throw new Error('Không tìm thấy phòng.');
  const bookings = await readJson<Array<{ roomId: string; status: string }>>('booking.records', []);
  if (bookings.some(item => item.roomId === id && ['PENDING', 'APPROVED'].includes(item.status))) {
    throw new Error('Phòng còn yêu cầu đang hoạt động nên chưa thể xóa.');
  }
  await writeJson(ROOMS_KEY, rooms.filter(room => room.id !== id));
}

export type RoomSearchFilters = {
  keyword?: string;
  floor?: number;
  minCapacity?: number;
  equipment?: string;
  lockType?: LockType | 'ALL';
};

export async function searchRooms(filters: RoomSearchFilters): Promise<Room[]> {
  const rooms = await getRooms();
  const keyword = filters.keyword?.trim().toLowerCase() ?? '';
  const equipment = filters.equipment?.trim().toLowerCase() ?? '';
  return rooms.filter(room =>
    (!filters.floor || room.floor === filters.floor) &&
    (!keyword || `${room.name} ${room.location}`.toLowerCase().includes(keyword)) &&
    (!filters.minCapacity || room.capacity >= filters.minCapacity) &&
    (!equipment || room.equipment.some(item => item.toLowerCase().includes(equipment))) &&
    (!filters.lockType || filters.lockType === 'ALL' || room.lockType === filters.lockType),
  );
}
