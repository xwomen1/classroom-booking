export type MaintenanceRecord = {
  id: string;
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdAt: string;
  createdBy: string;
  cancelledAt?: string;
};
