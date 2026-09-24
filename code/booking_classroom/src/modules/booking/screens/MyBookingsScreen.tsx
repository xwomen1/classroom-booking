import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import {
  createTemporaryPin,
  getPinDisplayStatus,
} from '../../access_control';
import type { Booking } from '../model/booking';
import {
  cancelBooking,
  getBookingsForUser,
} from '../services/bookingRepository';
import { BookingInfo } from '../components/BookingInfo';

type MyBookingsScreenProps = {
  username: string;
  title: string;
  onBack: () => void;
};

const PIN_STATUS_LABEL = {
  PENDING: 'Chưa đến thời gian hiệu lực',
  ACTIVE: 'Đang có hiệu lực',
  EXPIRED: 'Đã hết hạn',
  REVOKED: 'Đã thu hồi',
};

export function MyBookingsScreen({
  username,
  title,
  onBack,
}: MyBookingsScreenProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [revealedPinId, setRevealedPinId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = () => getBookingsForUser(username).then(setBookings);
  useEffect(() => {
    getBookingsForUser(username).then(setBookings);
  }, [username]);

  const cancel = async (bookingId: string) => {
    try {
      await cancelBooking(bookingId, username);
      setMessage('Đã hủy yêu cầu và thu hồi mã liên quan.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể hủy yêu cầu.');
    }
  };

  const generatePin = async (bookingId: string) => {
    try {
      const updated = await createTemporaryPin(bookingId, username, 'user');
      setMessage(`Đã tạo mật khẩu tạm thời ${updated.temporaryPin?.code}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo mã.');
    }
  };

  return (
    <View style={styles.page}>
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {bookings.length === 0 ? (
          <Text style={styles.empty}>Bạn chưa có yêu cầu đặt phòng.</Text>
        ) : (
          bookings.map(booking => {
            const pinStatus = getPinDisplayStatus(booking);
            const pin = booking.temporaryPin;
            const reveal = revealedPinId === booking.id;
            return (
              <View key={booking.id} style={styles.card}>
                <BookingInfo booking={booking} />
                {pin ? (
                  <View style={styles.pinBox} testID={`user-pin-${booking.id}`}>
                    <View style={styles.pinHeading}>
                      <View style={styles.pinTextArea}>
                        <Text style={styles.pinLabel}>Mã mở cửa tạm thời</Text>
                        <Text style={styles.pinStatus}>
                          {pinStatus ? PIN_STATUS_LABEL[pinStatus] : ''}
                        </Text>
                      </View>
                      <Text style={styles.pinCode}>
                        {reveal ? pin.code : '••••••'}
                      </Text>
                    </View>
                    <Text style={styles.pinTime}>
                      Hiệu lực: {new Date(pin.validFrom).toLocaleString('vi-VN')} –{' '}
                      {new Date(pin.validUntil).toLocaleString('vi-VN')}
                    </Text>
                    <Pressable
                      onPress={() => setRevealedPinId(reveal ? null : booking.id)}
                      style={styles.linkButton}
                    >
                      <Text style={styles.linkText}>{reveal ? 'Ẩn mã' : 'Xem mã'}</Text>
                    </Pressable>
                  </View>
                ) : booking.status === 'APPROVED' && booking.userCanGeneratePin ? (
                  <View style={styles.permissionBox}>
                    <Text style={styles.permissionText}>
                      Admin đã cho phép bạn tự tạo mã mở cửa.
                    </Text>
                    <Pressable
                      onPress={() => generatePin(booking.id)}
                      style={styles.generateButton}
                      testID={`user-generate-pin-${booking.id}`}
                    >
                      <Text style={styles.generateText}>Tạo mật khẩu tạm thời</Text>
                    </Pressable>
                  </View>
                ) : booking.status === 'APPROVED' ? (
                  <Text style={styles.waitingPin}>Đang chờ Admin cấp mã hoặc cấp quyền tự tạo mã.</Text>
                ) : null}
                {booking.status === 'PENDING' || booking.status === 'APPROVED' ? (
                  <Pressable onPress={() => cancel(booking.id)} style={styles.cancelButton}>
                    <Text style={styles.cancelText}>Hủy yêu cầu</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  message: { backgroundColor: '#EDF5FF', borderRadius: 9, color: '#24598F', marginBottom: 12, padding: 11 },
  empty: { color: '#657084', marginTop: 40, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E1E6EE', borderRadius: 13, borderWidth: 1, marginBottom: 13, padding: 16 },
  pinBox: { backgroundColor: '#F4F0FF', borderColor: '#D8CBF5', borderRadius: 10, borderWidth: 1, marginTop: 14, padding: 13 },
  pinHeading: { alignItems: 'center', flexDirection: 'row' },
  pinTextArea: { flex: 1 },
  pinLabel: { color: '#45316D', fontSize: 13, fontWeight: '800' },
  pinStatus: { color: '#725E99', fontSize: 11, marginTop: 3 },
  pinCode: { color: '#3B235F', fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  pinTime: { color: '#62547B', fontSize: 11, lineHeight: 17, marginTop: 9 },
  linkButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  linkText: { color: '#6A42A1', fontSize: 13, fontWeight: '800' },
  waitingPin: { backgroundColor: '#FFF7E7', borderRadius: 8, color: '#765014', marginTop: 13, padding: 10 },
  permissionBox: { backgroundColor: '#F4F0FF', borderRadius: 9, marginTop: 13, padding: 12 },
  permissionText: { color: '#5C4778', fontSize: 13, marginBottom: 9 },
  generateButton: { alignItems: 'center', backgroundColor: '#5A3788', borderRadius: 8, paddingVertical: 11 },
  generateText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cancelButton: { alignSelf: 'flex-start', marginTop: 13, paddingVertical: 5 },
  cancelText: { color: '#B01432', fontSize: 13, fontWeight: '800' },
});
