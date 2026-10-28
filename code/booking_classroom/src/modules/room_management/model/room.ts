export type LockType = 'PIN_CODE' | 'PHYSICAL_KEY';

export type Room = {
  id: string;
  name: string;
  floor: number;
  location: string;
  capacity: number;
  equipment: readonly string[];
  lockType: LockType;
  status: 'AVAILABLE' | 'MAINTENANCE';
  /** Phòng đặc biệt: yêu cầu đặt luôn chờ admin duyệt, kể cả khi bật tự động duyệt. */
  requiresApproval?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
