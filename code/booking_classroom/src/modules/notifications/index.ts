export { PriorityBannerHost } from './components/PriorityBannerHost';
export { NotificationScreen } from './screens/NotificationScreen';
export {
  addNotification,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
} from './services/notificationRepository';
export { requestPriorityNotificationPermission } from './services/priorityBanner';
export type { NotificationItem } from './model/notificationItem';
