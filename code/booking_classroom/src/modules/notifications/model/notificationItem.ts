export type NotificationTone = 'positive' | 'negative' | 'attention' | 'neutral';

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  /** Optional so notifications saved by older app versions remain usable. */
  tone?: NotificationTone;
};
