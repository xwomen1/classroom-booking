import type { Room } from './room';

export const EQUIPMENT_OPTIONS = [
  'Máy chiếu',
  'Điều hòa',
  'TV',
  'Bảng thông minh',
  'Micro',
  'Camera',
  'Loa',
] as const;

/** Các mức sức chứa thật sự có trong sơ đồ phòng. */
export const CAPACITY_OPTIONS = [30, 35, 40, 45, 50, 60, 80] as const;

export function roomMeetsMinCapacity(capacity: unknown, minimum: number | null): boolean {
  if (minimum == null) return true;
  const value = typeof capacity === 'number' ? capacity : Number(String(capacity ?? '').trim());
  return Number.isFinite(value) && value >= minimum;
}

export function normalizeEquipmentName(value: string): string {
  return value.trim().toLocaleLowerCase('vi');
}

export function roomHasAllEquipment(
  owned: readonly string[],
  required: readonly string[],
): boolean {
  if (required.length === 0) return true;
  const ownedNames = new Set(owned.map(normalizeEquipmentName));
  return required.every(item => ownedNames.has(normalizeEquipmentName(item)));
}

export function equipmentChoices(current: readonly string[]): string[] {
  const extras = current.filter(
    item =>
      !EQUIPMENT_OPTIONS.some(
        option => normalizeEquipmentName(option) === normalizeEquipmentName(item),
      ),
  );
  return [...EQUIPMENT_OPTIONS, ...extras];
}

export function toggleEquipment(selected: readonly string[], option: string): string[] {
  const key = normalizeEquipmentName(option);
  const exists = selected.some(item => normalizeEquipmentName(item) === key);
  return exists
    ? selected.filter(item => normalizeEquipmentName(item) !== key)
    : [...selected, option];
}

export function isEquipmentSelected(selected: readonly string[], option: string): boolean {
  const key = normalizeEquipmentName(option);
  return selected.some(item => normalizeEquipmentName(item) === key);
}

/** Ô 0–6 trên sơ đồ một tầng, đúng số phòng 101…107 chứ không theo thứ tự chữ. */
export function floorMapSlot(room: Pick<Room, 'id' | 'name' | 'floor'>): number | null {
  const fromId = room.id.match(/^room-floor-(\d+)-(\d+)$/);
  if (fromId && Number(fromId[1]) === room.floor) {
    const ordinal = Number(fromId[2]);
    return ordinal >= 1 && ordinal <= 7 ? ordinal - 1 : null;
  }
  if (room.id === 'room-a101' && room.floor === 1) return 0;
  if (room.id === 'room-b202' && room.floor === 2) return 1;
  const numeric = room.name.trim().toUpperCase().match(/^(?:[AB])?([1-8])0([1-7])$/);
  if (numeric && Number(numeric[1]) === room.floor) return Number(numeric[2]) - 1;
  return null;
}

export function matchesRoomQuery(room: Pick<Room, 'name' | 'location'>, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const name = room.name.toLowerCase();
  if (/^\d+$/.test(normalized)) return name.startsWith(normalized);
  return name.includes(normalized) || room.location.toLowerCase().includes(normalized);
}
