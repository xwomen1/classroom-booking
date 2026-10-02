import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import type { NotificationItem } from '../model/notificationItem';
import {
  getNotifications,
  markAllNotificationsRead,
} from '../services/notificationRepository';

type NotificationScreenProps = {
  username: string;
  onBack: () => void;
  onOpen?: (notification: NotificationItem) => void;
};

export function NotificationScreen({
  username,
  onBack,
  onOpen,
}: NotificationScreenProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    getNotifications(username).then(setNotifications);
  }, [username]);

  const markAllRead = async () => {
    await markAllNotificationsRead(username);
    setNotifications(current =>
      current.map(notification => ({ ...notification, read: true })),
    );
  };

  return (
    <View style={styles.page} testID="notification-screen">
      <ScreenHeader
        actionLabel={
          notifications.some(notification => !notification.read)
            ? 'Đọc tất cả'
            : undefined
        }
        onAction={
          notifications.some(notification => !notification.read)
            ? markAllRead
            : undefined
        }
        onBack={onBack}
        title="Thông báo"
      />
      <ScrollView contentContainerStyle={styles.content}>
        {notifications.length === 0 ? (
          <Text style={styles.empty}>Chưa có thông báo.</Text>
        ) : (
          notifications.map(notification => (
            <Pressable
              key={notification.id}
              testID={`notification-card-${notification.id}`}
              onPress={() => onOpen?.(notification)}
              style={[
                styles.card,
                isApprovalNotification(notification)
                  ? styles.approvedCard
                  : !notification.read && styles.unreadCard,
              ]}
            >
              <View style={styles.cardHeader}>
                {!notification.read ? (
                  <View style={[
                    styles.unreadDot,
                    isApprovalNotification(notification) && styles.approvedDot,
                  ]} testID={`notification-unread-dot-${notification.id}`} />
                ) : null}
                <Text style={styles.title}>{notification.title}</Text>
              </View>
              <Text style={styles.message}>{notification.message}</Text>
              <Text style={styles.time}>
                {new Date(notification.createdAt).toLocaleString('vi-VN')}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  empty: { color: '#657084', marginTop: 40, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E6EE',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 11,
    padding: 15,
  },
  unreadCard: { backgroundColor: '#FFF6F7', borderColor: '#E7B4BD' },
  approvedCard: { backgroundColor: '#EAF7EF', borderColor: '#9BCFAE' },
  cardHeader: { alignItems: 'center', flexDirection: 'row' },
  unreadDot: {
    backgroundColor: '#B01432',
    borderRadius: 5,
    height: 9,
    marginRight: 8,
    width: 9,
  },
  approvedDot: { backgroundColor: '#22864A' },
  title: { color: '#172033', flex: 1, fontSize: 15, fontWeight: '800' },
  message: { color: '#4F5C70', fontSize: 14, lineHeight: 20, marginTop: 7 },
  time: { color: '#8993A3', fontSize: 12, marginTop: 10 },
});

function isApprovalNotification(notification: NotificationItem): boolean {
  return `${notification.title} ${notification.message}`
    .toLocaleLowerCase('vi-VN')
    .includes('được duyệt');
}
