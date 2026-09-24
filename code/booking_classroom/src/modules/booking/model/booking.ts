export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type TemporaryPin = {
  code: string;
  createdAt: string;
  createdBy: string;
  validFrom: string;
  validUntil: string;
  revokedAt?: string;
};

export type KeyPickupAppointment = {
  date: string;
  time: string;
  location: string;
  createdAt: string;
  createdBy: string;
};

export type PickupDelegate = {
  fullName: string;
  studentId: string;
  delegatedAt: string;
};

export type RoomChange = {
  fromRoomId: string;
  toRoomId: string;
  changedAt: string;
  changedBy: string;
  reason: string;
};

export type Booking = {
  id: string;
  requesterUsername: string;
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  userCanGeneratePin?: boolean;
  temporaryPin?: TemporaryPin;
  keyPickupAppointment?: KeyPickupAppointment;
  pickupDelegate?: PickupDelegate;
  roomChanges?: RoomChange[];
};

export type CreateBookingInput = Pick<
  Booking,
  'requesterUsername' | 'roomId' | 'date' | 'startTime' | 'endTime' | 'purpose'
>;
