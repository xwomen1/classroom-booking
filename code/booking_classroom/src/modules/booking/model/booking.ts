export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'NO_SHOW';

export type TemporaryPin = {
  code: string;
  createdAt: string;
  createdBy: string;
  validFrom: string;
  validUntil: string;
  lockPasswordId?: number;
  lockCommandId?: string;
  lockDeliveredAt?: string;
  revokedAt?: string;
};

export type KeyPickupAppointment = {
  date: string;
  time: string;
  location: string;
  createdAt: string;
  createdBy: string;
  agreedAt?: string;
  agreedBy?: string;
};

export type KeyPickupProposal = {
  id: string;
  date: string;
  time: string;
  location?: string;
  proposedAt: string;
  proposedBy: string;
  proposedByRole: 'admin' | 'user';
};

export type KeyPickupNegotiation = {
  status: 'WAITING_ADMIN' | 'WAITING_USER' | 'AGREED';
  currentProposal: KeyPickupProposal;
  history: KeyPickupProposal[];
  agreedAt?: string;
  agreedBy?: string;
};

export type SmartLockAccessEvent = {
  type: 'CHECK_IN' | 'CHECK_OUT';
  occurredAt: string;
  trait: string;
  deviceId?: string;
  topic?: string;
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
  repeatWeekly?: boolean;
  repeatWeeks?: number;
  recurringSeriesId?: string;
  recurringWeekIndex?: number;
  status: BookingStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  userCanGeneratePin?: boolean;
  temporaryPin?: TemporaryPin;
  keyPickupAppointment?: KeyPickupAppointment;
  keyPickupNegotiation?: KeyPickupNegotiation;
  pickupDelegate?: PickupDelegate;
  roomChanges?: RoomChange[];
  smartLockAccessEvents?: SmartLockAccessEvent[];
  checkedInAt?: string;
  checkInConfirmedBy?: string;
  checkedOutAt?: string;
  noShowAt?: string;
  noShowMarkedBy?: string;
};

export type CreateBookingInput = Pick<
  Booking,
  'requesterUsername' | 'roomId' | 'date' | 'startTime' | 'endTime' | 'purpose'
> & {
  repeatWeekly?: boolean;
  repeatWeeks?: number;
};
