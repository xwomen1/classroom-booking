export type ManagedSmartLock = {
  id: 'primary-smart-lock';
  displayName: string;
  model: string;
  aeId: string;
  deviceId: string;
  deviceName: string;
  gatewayBaseUrl: string;
  assignedRoomId?: string;
  assignedAt?: string;
  assignedBy?: string;
  nextPasswordId: number;
};

export type SmartLockGatewayStatus = {
  connected: boolean;
  configured: boolean;
  lock: {
    aeId: string;
    deviceId: string;
    deviceName: string;
    model: string;
  };
  lastCommand?: {
    trait: string;
    passwordId: number;
    publishedAt: string;
  };
  lastResponse?: {
    trait: string;
    receivedAt: string;
  };
  error?: string;
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
