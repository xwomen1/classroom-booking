export type AppConfiguration = {
  minAdvanceDays: number;
  maxAdvanceDays: number;
  maxActiveBookingsPerUser: number;
  cancellationCutoffMinutes: number;
  roomChangeCutoffMinutes: number;
  pinGraceMinutes: number;
  notificationsEnabled: boolean;
};

export const DEFAULT_CONFIGURATION: AppConfiguration = {
  minAdvanceDays: 1,
  maxAdvanceDays: 3,
  maxActiveBookingsPerUser: 2,
  cancellationCutoffMinutes: 30,
  roomChangeCutoffMinutes: 30,
  pinGraceMinutes: 10,
  notificationsEnabled: true,
};
