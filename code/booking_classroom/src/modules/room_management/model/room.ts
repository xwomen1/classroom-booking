export type LockType = 'PIN_CODE' | 'PHYSICAL_KEY';

export type Room = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  equipment: readonly string[];
  lockType: LockType;
  status: 'AVAILABLE' | 'MAINTENANCE';
  createdAt?: string;
  updatedAt?: string;
};
