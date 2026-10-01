export type ManagedSmartLock = {
  id: 'primary-smart-lock';
  displayName: string;
  model: string;
  smartLockAeId: string;
  smartLockDeviceId: string;
  smartLockDeviceName: string;
  oneIotBroker: string;
  oneIotPort: number;
  oneIotCseId: string;
  toolDeviceId: string;
  assignedRoomId?: string;
  assignedAt?: string;
  assignedBy?: string;
  nextPasswordId: number;
};

export type OneIoTConnectionStatus = {
  connected: boolean;
  broker?: string;
  toolDeviceId?: string;
};

export type TemporaryPasswordCommand = {
  roomId: string;
  roomName: string;
  code: string;
  passwordId: number;
  startTime: number;
  endTime: number;
};

export type TemporaryPasswordCommandResult = {
  accepted: boolean;
  trait: 'traitCreateTmpPasswordLock';
  requestId: string;
  passwordId: number;
  publishedAt: string;
};
