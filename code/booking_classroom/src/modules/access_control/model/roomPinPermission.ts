export type RoomPinPermission = {
  id: string;
  username: string;
  roomId: string;
  grantedAt: string;
  grantedBy: string;
  active: boolean;
  revokedAt?: string;
  revokedBy?: string;
};
