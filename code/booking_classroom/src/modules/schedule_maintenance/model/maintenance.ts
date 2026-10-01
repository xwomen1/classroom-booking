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

export type MaintenanceRequestStatus = 'PENDING' | 'SCHEDULED' | 'REJECTED';

export type MaintenanceRequest = {
  id: string;
  bookingId: string;
  roomId: string;
  requesterUsername: string;
  reason: string;
  requestedAt: string;
  status: MaintenanceRequestStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
  maintenanceRecordId?: string;
};
