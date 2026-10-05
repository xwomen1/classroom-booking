import { floorMapSlot, roomHasAllEquipment, roomMeetsMinCapacity } from '../src/modules/room_management/model/roomFilters';

describe('room filters', () => {
  test('capacity keeps the exact threshold and every larger room', () => {
    expect(roomMeetsMinCapacity(40, 40)).toBe(true);
    expect(roomMeetsMinCapacity('45', 40)).toBe(true);
    expect(roomMeetsMinCapacity(35, 40)).toBe(false);
    expect(roomMeetsMinCapacity('35', 40)).toBe(false);
    expect(roomMeetsMinCapacity(30, null)).toBe(true);
  });

  test('equipment matches the whole device name', () => {
    expect(roomHasAllEquipment(['Máy chiếu', 'Điều hòa'], ['Máy chiếu'])).toBe(true);
    expect(roomHasAllEquipment(['Máy chiếu'], ['Máy'])).toBe(false);
    expect(roomHasAllEquipment(['TV', 'Điều hòa'], ['TV', 'Camera'])).toBe(false);
  });

  test('map slot follows the room number', () => {
    expect(floorMapSlot({ id: 'room-a101', name: '101', floor: 1 })).toBe(0);
    expect(floorMapSlot({ id: 'room-floor-1-4', name: '104', floor: 1 })).toBe(3);
    expect(floorMapSlot({ id: 'room-b202', name: '202', floor: 2 })).toBe(1);
  });
});
