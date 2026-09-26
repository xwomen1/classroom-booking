import type { Room } from './room';

const CAPACITIES = [30, 45, 60, 35, 50, 40, 80] as const;
const EQUIPMENT = [
  ['Máy chiếu', 'Điều hòa'],
  ['TV', 'Bảng thông minh'],
  ['Máy chiếu', 'Micro'],
  ['Điều hòa', 'Camera'],
  ['Máy chiếu', 'Loa'],
  ['TV', 'Điều hòa'],
  ['Máy chiếu', 'Micro', 'Camera'],
] as const;

/** Dữ liệu khởi tạo gồm bảy phòng cho mỗi tầng. */
export const DEMO_ROOMS: readonly Room[] = Array.from(
  { length: 8 },
  (_floorValue, floorIndex) => {
    const floor = floorIndex + 1;
    return Array.from({ length: 7 }, (_roomValue, roomIndex): Room => {
      const ordinal = roomIndex + 1;
      const isLegacyA101 = floor === 1 && ordinal === 1;
      const isLegacyB202 = floor === 2 && ordinal === 2;
      return {
        id: isLegacyA101
          ? 'room-a101'
          : isLegacyB202
            ? 'room-b202'
            : `room-floor-${floor}-${ordinal}`,
        name: isLegacyB202 ? 'B202' : `A${floor}0${ordinal}`,
        floor,
        location: `Tầng ${floor}, tòa nhà A`,
        capacity: CAPACITIES[roomIndex],
        equipment: [...EQUIPMENT[roomIndex]],
        lockType:
          isLegacyB202 || roomIndex % 3 === 2 ? 'PHYSICAL_KEY' : 'PIN_CODE',
        status: 'AVAILABLE',
      };
    });
  },
).flat();
