/* eslint-env jest */
import {
  DEMO_ROOMS,
  createRoom,
  deleteRoom,
  getRoomById,
  getRooms,
  searchRooms,
  updateRoom,
} from '../../src/modules/room_management';
import {
  equipmentChoices,
  floorMapSlot,
  isEquipmentSelected,
  matchesRoomQuery,
  normalizeEquipmentName,
  roomHasAllEquipment,
  roomMeetsMinCapacity,
  toggleEquipment,
} from '../../src/modules/room_management/model/roomFilters';
import { readJson, writeJson } from '../../src/core/storage/jsonStorage';
import { makeBooking, resetStorage, seedBookings } from '../support/testUtils';

const newRoom = {
  name: ' a901 ',
  floor: 8,
  location: '',
  capacity: 25,
  equipment: [' TV ', '', 'Loa'],
  lockType: 'PIN_CODE' as const,
  status: 'AVAILABLE' as const,
};

beforeEach(async () => {
  await resetStorage();
});

describe('roomRepository – dữ liệu khởi tạo', () => {
  test('seeds 8 floors × 7 rooms with unique ids and names', async () => {
    const rooms = await getRooms();
    expect(rooms).toHaveLength(56);
    expect(new Set(rooms.map(room => room.id)).size).toBe(56);
    expect(new Set(rooms.map(room => room.name)).size).toBe(56);
    for (let floor = 1; floor <= 8; floor += 1) {
      expect(rooms.filter(room => room.floor === floor)).toHaveLength(7);
    }
  });

  test('infers a missing floor from the location and merges new demo rooms', async () => {
    await writeJson('rooms.records', [
      { id: 'legacy', name: 'X1', location: 'Tầng 5, tòa nhà B', capacity: 10, equipment: [], lockType: 'PIN_CODE', status: 'AVAILABLE' },
      { id: 'nowhere', name: 'X2', location: 'Sân', capacity: 10, equipment: [], lockType: 'PIN_CODE', status: 'AVAILABLE' },
    ]);
    const rooms = await getRooms();
    expect(rooms.find(room => room.id === 'legacy')?.floor).toBe(5);
    expect(rooms.find(room => room.id === 'nowhere')?.floor).toBe(1);
    expect(rooms).toHaveLength(58);
    expect(await readJson<unknown[]>('rooms.records', [])).toHaveLength(58);
  });
});

describe('roomRepository – CRUD', () => {
  test('only admins can mutate rooms', async () => {
    await expect(createRoom(newRoom, 'user')).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
    await expect(deleteRoom('room-a101', 'user')).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });

  test('createRoom normalizes name, location and equipment', async () => {
    const room = await createRoom(newRoom, 'admin');
    expect(room).toMatchObject({ name: 'A901', location: 'Tầng 8, tòa nhà A', equipment: ['TV', 'Loa'] });
    expect(await getRoomById(room.id)).toEqual(room);
  });

  test.each([
    [{ name: '  ' }, 'Tên phòng không được để trống.'],
    [{ floor: 0 }, 'Tầng phải nằm trong khoảng 1 đến 8.'],
    [{ floor: 9 }, 'Tầng phải nằm trong khoảng 1 đến 8.'],
    [{ floor: 2.5 }, 'Tầng phải nằm trong khoảng 1 đến 8.'],
    [{ capacity: 0 }, 'Sức chứa phải là số nguyên dương.'],
    [{ capacity: 10.5 }, 'Sức chứa phải là số nguyên dương.'],
    [{ name: '101' }, 'Tên phòng đã tồn tại.'],
  ])('createRoom rejects %o', async (changes, message) => {
    await expect(createRoom({ ...newRoom, ...changes }, 'admin')).rejects.toThrow(message);
  });

  test('updateRoom rejects a duplicate name and an unknown id', async () => {
    await expect(updateRoom('room-a101', { ...newRoom, name: '102' }, 'admin')).rejects.toThrow('Tên phòng đã tồn tại.');
    await expect(updateRoom('missing', newRoom, 'admin')).rejects.toThrow('Không tìm thấy phòng.');
  });

  test('updateRoom keeps the id and allows keeping the same name', async () => {
    const original = (await getRoomById('room-a101'))!;
    const updated = await updateRoom('room-a101', { ...original, name: '101', capacity: 99 }, 'admin');
    expect(updated).toMatchObject({ id: 'room-a101', capacity: 99 });
    expect(updated.updatedAt).toBeDefined();
  });

  test('deleteRoom is blocked while the room has active bookings', async () => {
    await seedBookings([makeBooking({ roomId: 'room-a101', status: 'PENDING' })]);
    await expect(deleteRoom('room-a101', 'admin')).rejects.toThrow('Phòng còn yêu cầu đang hoạt động nên chưa thể xóa.');
    await expect(deleteRoom('missing', 'admin')).rejects.toThrow('Không tìm thấy phòng.');

    await seedBookings([makeBooking({ roomId: 'room-a101', status: 'REJECTED' })]);
    await expect(deleteRoom('room-a101', 'admin')).resolves.toBeUndefined();
    expect(await readJson<Array<{ id: string }>>('rooms.records', []))
      .not.toContainEqual(expect.objectContaining({ id: 'room-a101' }));
  });

  test('deleteRoom removes a custom room for good', async () => {
    const room = await createRoom(newRoom, 'admin');
    await deleteRoom(room.id, 'admin');
    expect(await getRoomById(room.id)).toBeUndefined();
  });

  // BUG đã biết: getRooms() gộp lại mọi DEMO_ROOMS còn thiếu, nên phòng demo
  // vừa xóa xuất hiện trở lại ở lần đọc kế tiếp. Khi sửa xong, đổi
  // `test.failing` thành `test`.
  test.failing('a deleted demo room stays deleted', async () => {
    await deleteRoom('room-a101', 'admin');
    expect(await getRoomById('room-a101')).toBeUndefined();
  });
});

describe('searchRooms', () => {
  test('filters by floor, keyword, capacity, equipment and lock type together', async () => {
    const results = await searchRooms({ floor: 1, minCapacity: 45, equipment: ['máy chiếu'], lockType: 'PHYSICAL_KEY' });
    expect(results.map(room => room.id)).toEqual(['room-floor-1-3']);
  });

  test('ALL lock type and empty filters return everything', async () => {
    expect(await searchRooms({ lockType: 'ALL' })).toHaveLength(56);
    expect(await searchRooms({})).toHaveLength(56);
  });

  test('keyword matches name or location', async () => {
    expect((await searchRooms({ keyword: '305' })).map(room => room.name)).toEqual(['305']);
    expect(await searchRooms({ keyword: 'tầng 4' })).toHaveLength(7);
  });
});

describe('roomFilters helpers', () => {
  test('roomMeetsMinCapacity handles strings, blanks and null', () => {
    expect(roomMeetsMinCapacity(40, null)).toBe(true);
    expect(roomMeetsMinCapacity(' 40 ', 40)).toBe(true);
    expect(roomMeetsMinCapacity('39', 40)).toBe(false);
    expect(roomMeetsMinCapacity('abc', 1)).toBe(false);
    expect(roomMeetsMinCapacity(undefined, 1)).toBe(false);
  });

  test('equipment helpers ignore case and spacing', () => {
    expect(normalizeEquipmentName('  MÁY Chiếu ')).toBe('máy chiếu');
    expect(roomHasAllEquipment(['Máy chiếu'], [])).toBe(true);
    expect(roomHasAllEquipment(['Máy chiếu', 'TV'], ['tv', ' MÁY CHIẾU'])).toBe(true);
    expect(roomHasAllEquipment(['Máy chiếu'], ['Máy'])).toBe(false);
    expect(isEquipmentSelected(['tv'], 'TV')).toBe(true);
    expect(toggleEquipment(['tv', 'Loa'], 'TV')).toEqual(['Loa']);
    expect(toggleEquipment(['Loa'], 'TV')).toEqual(['Loa', 'TV']);
  });

  test('equipmentChoices appends only unknown custom devices', () => {
    const choices = equipmentChoices(['tv', 'Máy hủy giấy']);
    expect(choices.filter(item => normalizeEquipmentName(item) === 'tv')).toHaveLength(1);
    expect(choices[choices.length - 1]).toBe('Máy hủy giấy');
  });

  test('floorMapSlot supports generated ids, legacy ids and names', () => {
    expect(floorMapSlot({ id: 'room-floor-3-5', name: '305', floor: 3 })).toBe(4);
    expect(floorMapSlot({ id: 'room-floor-3-9', name: '309', floor: 3 })).toBeNull();
    expect(floorMapSlot({ id: 'room-a101', name: 'A101', floor: 1 })).toBe(0);
    expect(floorMapSlot({ id: 'room-b202', name: 'B202', floor: 2 })).toBe(1);
    expect(floorMapSlot({ id: 'custom', name: 'B406', floor: 4 })).toBe(5);
    expect(floorMapSlot({ id: 'custom', name: '406', floor: 5 })).toBeNull();
    expect(floorMapSlot({ id: 'custom', name: 'Hội trường', floor: 1 })).toBeNull();
  });

  test('matchesRoomQuery: numeric queries match the room number prefix only', () => {
    const room = { name: '101', location: 'Tầng 1, tòa nhà A' };
    expect(matchesRoomQuery(room, '')).toBe(true);
    expect(matchesRoomQuery(room, '10')).toBe(true);
    expect(matchesRoomQuery(room, '01')).toBe(false);
    expect(matchesRoomQuery(room, 'tòa')).toBe(true);
  });

  test('demo rooms keep the documented lock layout', () => {
    expect(DEMO_ROOMS.find(room => room.id === 'room-a101')?.lockType).toBe('PIN_CODE');
    expect(DEMO_ROOMS.find(room => room.id === 'room-b202')?.lockType).toBe('PHYSICAL_KEY');
    expect(DEMO_ROOMS.filter(room => room.lockType === 'PHYSICAL_KEY').length).toBeGreaterThan(0);
  });
});
