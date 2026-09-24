import type { Room } from './room';

export const DEMO_ROOMS: readonly Room[] = [
  {
    id: 'room-a101',
    name: 'A101',
    location: 'Tầng 1, nhà A',
    capacity: 30,
    equipment: ['Máy chiếu', 'Điều hòa'],
    lockType: 'PIN_CODE',
    status: 'AVAILABLE',
  },
  {
    id: 'room-b202',
    name: 'B202',
    location: 'Tầng 2, nhà B',
    capacity: 50,
    equipment: ['Máy chiếu', 'Micro'],
    lockType: 'PHYSICAL_KEY',
    status: 'AVAILABLE',
  },
];
