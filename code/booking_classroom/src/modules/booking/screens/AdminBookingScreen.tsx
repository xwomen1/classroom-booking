import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import {
  createTemporaryPin,
  grantUserPinPermission,
} from '../../access_control';
import { getRoomById } from '../../room_management';
import { BookingInfo } from '../components/BookingInfo';
import type { Booking } from '../model/booking';
import { getBookings, reviewBooking } from '../services/bookingRepository';

type AdminBookingScreenProps = { username: string; onBack: () => void };

export function AdminBookingScreen({
  username,
  onBack,
}: AdminBookingScreenProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState('');

  const load = () =>
    getBookings().then(items =>
      setBookings(
        [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    );
  useEffect(() => {
    getBookings().then(items =>
      setBookings(
        [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    );
  }, []);

  const review = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await reviewBooking(id, decision, username);
      setMessage(decision === 'APPROVED' ? 'Đã duyệt yêu cầu.' : 'Đã từ chối yêu cầu.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.');
    }
  };

  const generatePin = async (id: string) => {
    try {
      const updated = await createTemporaryPin(id, username, 'admin');
      setMessage(`Đã tạo mã ${updated.temporaryPin?.code} cho ${updated.requesterUsername}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo mã.');
    }
  };

  const allowUserToGenerate = async (id: string) => {
    try {
      const updated = await grantUserPinPermission(id, username);
      setMessage(
        `Đã cho phép ${updated.requesterUsername} tự tạo mật khẩu tạm thời.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cấp quyền.');
    }
  };

  return (
    <View style={styles.page}>
      <ScreenHeader title="Quản lý mượn phòng" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {bookings.length === 0 ? (
          <Text style={styles.empty}>Chưa có yêu cầu đặt phòng.</Text>
        ) : (
          bookings.map(booking => {
            const room = getRoomById(booking.roomId);
            return (
              <View key={booking.id} style={styles.card}>
                <BookingInfo booking={booking} />
                {booking.status === 'PENDING' ? (
                  <View style={styles.actions}>
                    <ActionButton label="Duyệt" onPress={() => review(booking.id, 'APPROVED')} primary />
                    <ActionButton label="Từ chối" onPress={() => review(booking.id, 'REJECTED')} />
                  </View>
                ) : null}
                {booking.status === 'APPROVED' && room?.lockType === 'PIN_CODE' && !booking.temporaryPin ? (
                  <View style={styles.pinActions}>
                    <Pressable
                      onPress={() => generatePin(booking.id)}
                      style={({ pressed }) => [styles.generateButton, pressed && styles.pressed]}
                      testID={`generate-pin-${booking.id}`}
                    >
                      <Text style={styles.generateText}>Admin tạo mã</Text>
                    </Pressable>
                    <Pressable
                      disabled={booking.userCanGeneratePin}
                      onPress={() => allowUserToGenerate(booking.id)}
                      style={({ pressed }) => [
                        styles.allowButton,
                        (pressed || booking.userCanGeneratePin) && styles.disabledButton,
                      ]}
                      testID={`allow-user-pin-${booking.id}`}
                    >
                      <Text style={styles.allowText}>
                        {booking.userCanGeneratePin ? 'Đã cho User tự tạo' : 'Cho User tự tạo mã'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {booking.temporaryPin ? (
                  <View style={styles.pinBox}>
                    <Text style={styles.pinLabel}>Mật khẩu tạm thời đã cấp</Text>
                    <Text style={styles.pinCode}>{booking.temporaryPin.code}</Text>
                    <Text style={styles.pinTime}>
                      {new Date(booking.temporaryPin.validFrom).toLocaleString('vi-VN')} –{' '}
                      {new Date(booking.temporaryPin.validUntil).toLocaleString('vi-VN')}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

type ActionButtonProps = { label: string; onPress: () => void; primary?: boolean };
function ActionButton({ label, onPress, primary }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, primary && styles.primaryAction, pressed && styles.pressed]}
    >
      <Text style={[styles.actionText, primary && styles.primaryActionText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  message: { backgroundColor: '#EDF5FF', borderRadius: 9, color: '#24598F', marginBottom: 12, padding: 11 },
  empty: { color: '#657084', marginTop: 40, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E1E6EE', borderRadius: 13, borderWidth: 1, marginBottom: 13, padding: 16 },
  actions: { flexDirection: 'row', marginTop: 14 },
  actionButton: { alignItems: 'center', borderColor: '#B01432', borderRadius: 9, borderWidth: 1, flex: 1, marginRight: 8, paddingVertical: 10 },
  primaryAction: { backgroundColor: '#B01432' },
  actionText: { color: '#B01432', fontSize: 13, fontWeight: '800' },
  primaryActionText: { color: '#FFFFFF' },
  generateButton: { alignItems: 'center', backgroundColor: '#5A3788', borderRadius: 9, marginTop: 14, paddingVertical: 12 },
  generateText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pinActions: { marginTop: 14 },
  allowButton: { alignItems: 'center', borderColor: '#5A3788', borderRadius: 9, borderWidth: 1, marginTop: 8, paddingVertical: 11 },
  allowText: { color: '#5A3788', fontSize: 13, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  pinBox: { backgroundColor: '#F4F0FF', borderRadius: 10, marginTop: 14, padding: 13 },
  pinLabel: { color: '#66547D', fontSize: 12, fontWeight: '700' },
  pinCode: { color: '#3B235F', fontSize: 25, fontWeight: '900', letterSpacing: 4, marginTop: 5 },
  pinTime: { color: '#725E88', fontSize: 11, lineHeight: 17, marginTop: 5 },
  pressed: { opacity: 0.68 },
});
