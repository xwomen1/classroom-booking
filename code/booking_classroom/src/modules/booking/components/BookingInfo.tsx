import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getRoomById, type Room } from '../../room_management';
import type { Booking, BookingStatus } from '../model/booking';

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

export function BookingInfo({ booking }: { booking: Booking }) {
  const [room, setRoom] = useState<Room | undefined>();
  useEffect(() => { getRoomById(booking.roomId).then(setRoom); }, [booking.roomId]);
  return (
    <>
      <View style={styles.heading}>
        <Text style={styles.room}>{room?.name ?? booking.roomId}</Text>
        <View style={[styles.status, styles[`status${booking.status}`]]}>
          <Text style={styles.statusText}>{STATUS_LABELS[booking.status]}</Text>
        </View>
      </View>
      <Text style={styles.line}>{room?.location}</Text>
      <Text style={styles.line}>
        {booking.date} · {booking.startTime}–{booking.endTime}
      </Text>
      <Text style={styles.purpose}>{booking.purpose}</Text>
      <Text style={styles.requester}>Người đặt: {booking.requesterUsername}</Text>
      {booking.keyPickupAppointment ? (
        <Text style={styles.accessLine}>Nhận khóa: {booking.keyPickupAppointment.date} {booking.keyPickupAppointment.time} · {booking.keyPickupAppointment.location}</Text>
      ) : null}
      {booking.pickupDelegate ? (
        <Text style={styles.accessLine}>Người nhận hộ: {booking.pickupDelegate.fullName} · {booking.pickupDelegate.studentId}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'center', flexDirection: 'row', marginBottom: 7 },
  room: { color: '#172033', flex: 1, fontSize: 18, fontWeight: '800' },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPENDING: { backgroundColor: '#FFF0CC' },
  statusAPPROVED: { backgroundColor: '#DDF4E7' },
  statusREJECTED: { backgroundColor: '#FBE1E4' },
  statusCANCELLED: { backgroundColor: '#E8EBF0' },
  statusText: { color: '#253047', fontSize: 11, fontWeight: '800' },
  line: { color: '#566176', fontSize: 14, marginTop: 3 },
  purpose: { color: '#253047', fontSize: 14, fontWeight: '700', marginTop: 9 },
  requester: { color: '#7B8596', fontSize: 12, marginTop: 7 },
  accessLine: { color: '#5A3788', fontSize: 12, fontWeight: '700', marginTop: 6 },
});
