/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import App from '../App';
import { RoleDashboardScreen } from '../src/app/screens/RoleDashboardScreen';
import { storage, writeJson } from '../src/core/storage/jsonStorage';
import { AdminBookingScreen } from '../src/modules/booking/screens/AdminBookingScreen';
import { BookingInfo } from '../src/modules/booking/components/BookingInfo';
import { NotificationScreen } from '../src/modules/notifications';

beforeEach(async () => {
  await storage.clear();
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
  });
});

test('renders approved notifications with green styling', async () => {
  await writeJson('notifications.user', [{
    id: 'approved-booking',
    title: 'Yêu cầu đã được duyệt',
    message: 'Phòng A101 đã được duyệt.',
    createdAt: new Date().toISOString(),
    read: false,
  }]);

  let tree: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <NotificationScreen username="user" onBack={() => {}} />,
    );
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });

  const card = tree!.root.findByProps({ testID: 'notification-card-approved-booking' });
  expect(StyleSheet.flatten(card.props.style)).toMatchObject({
    backgroundColor: '#EAF7EF',
    borderColor: '#9BCFAE',
  });
  const unreadDot = card.findByProps({ testID: 'notification-unread-dot-approved-booking' });
  expect(StyleSheet.flatten(unreadDot.props.style)).toMatchObject({ backgroundColor: '#22864A' });
});

test('shows 9+ on the Admin booking card when more than nine requests are pending', async () => {
  await writeJson('booking.records', Array.from({ length: 10 }, (_, index) => ({
    id: `pending-booking-${index}`,
    requesterUsername: 'user',
    roomId: 'room-a101',
    date: '2026-10-03',
    startTime: '08:00',
    endTime: '09:00',
    purpose: 'Kiểm thử badge',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  })));

  let tree: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <RoleDashboardScreen
        session={{ username: 'admin', role: 'admin' }}
        onLogout={() => {}}
      />,
    );
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });

  const card = tree!.root.findByProps({ testID: 'admin-booking-requests-card' });
  const badge = card.findByProps({ testID: 'pending-booking-badge' });
  expect(badge.findByType(Text).props.children).toBe('9+');
});

test('collapses Admin booking details until the summary is pressed', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  await writeJson('booking.records', [{
    id: 'pending-admin-card',
    requesterUsername: 'user',
    roomId: 'room-a101',
    date,
    startTime: '08:00',
    endTime: '09:00',
    purpose: 'Kiểm tra accordion',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  }]);

  let tree: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <AdminBookingScreen username="admin" onBack={() => {}} />,
    );
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });

  const summary = tree!.root.findByProps({ testID: 'admin-booking-summary-pending-admin-card' });
  expect(tree!.root.findAllByType(BookingInfo)).toHaveLength(0);

  await ReactTestRenderer.act(async () => summary.props.onPress());
  expect(tree!.root.findAllByType(BookingInfo)).toHaveLength(1);
});
