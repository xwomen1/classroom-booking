import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared';
import { DEMO_ROOMS } from '../../room_management';
import { createBooking } from '../services/bookingRepository';

type CreateBookingScreenProps = { username: string; onBack: () => void };

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
}

export function CreateBookingScreen({
  username,
  onBack,
}: CreateBookingScreenProps) {
  const [roomId, setRoomId] = useState(DEMO_ROOMS[0].id);
  const [date, setDate] = useState(tomorrow());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await createBooking({
        requesterUsername: username,
        roomId,
        date,
        startTime,
        endTime,
        purpose,
      });
      setIsError(false);
      setMessage('Đã gửi yêu cầu. Hãy đăng nhập Admin để phê duyệt.');
      setPurpose('');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể tạo yêu cầu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScreenHeader title="Đặt phòng" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Chọn phòng</Text>
        {DEMO_ROOMS.map(room => (
          <Pressable
            key={room.id}
            onPress={() => setRoomId(room.id)}
            style={[styles.roomCard, roomId === room.id && styles.selectedRoom]}
          >
            <View style={styles.roomTitleRow}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.lockBadge}>
                {room.lockType === 'PIN_CODE' ? 'Khóa mã số' : 'Khóa cơ/thẻ'}
              </Text>
            </View>
            <Text style={styles.roomDetail}>
              {room.location} · {room.capacity} người
            </Text>
            <Text style={styles.roomDetail}>{room.equipment.join(', ')}</Text>
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Thời gian và mục đích</Text>
        <Field label="Ngày (YYYY-MM-DD)" onChangeText={setDate} value={date} testID="booking-date" />
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Field label="Bắt đầu" onChangeText={setStartTime} value={startTime} testID="booking-start" />
          </View>
          <View style={styles.timeSpacer} />
          <View style={styles.timeField}>
            <Field label="Kết thúc" onChangeText={setEndTime} value={endTime} testID="booking-end" />
          </View>
        </View>
        <Field
          label="Mục đích sử dụng"
          multiline
          onChangeText={setPurpose}
          placeholder="Ví dụ: Họp nhóm đồ án"
          testID="booking-purpose"
          value={purpose}
        />
        <Text style={styles.rule}>Đặt trước từ 1 đến 3 ngày; mỗi tài khoản có tối đa 2 yêu cầu đang hoạt động.</Text>
        {message ? <Text style={isError ? styles.error : styles.success}>{message}</Text> : null}
        <Pressable
          disabled={saving}
          onPress={submit}
          style={({ pressed }) => [styles.button, (pressed || saving) && styles.pressed]}
          testID="booking-submit"
        >
          <Text style={styles.buttonText}>{saving ? 'Đang gửi...' : 'Gửi yêu cầu đặt phòng'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#7D8795" style={[styles.input, props.multiline && styles.multiline]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 20, paddingBottom: 36 },
  sectionTitle: { color: '#253047', fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  roomCard: { backgroundColor: '#FFFFFF', borderColor: '#D6DDE8', borderRadius: 12, borderWidth: 1, marginBottom: 10, padding: 14 },
  selectedRoom: { borderColor: '#B01432', borderWidth: 2 },
  roomTitleRow: { alignItems: 'center', flexDirection: 'row' },
  roomName: { color: '#172033', flex: 1, fontSize: 17, fontWeight: '800' },
  lockBadge: { backgroundColor: '#EDF3FB', borderRadius: 999, color: '#255B91', fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 4 },
  roomDetail: { color: '#657084', fontSize: 13, marginTop: 5 },
  field: { marginBottom: 14 },
  label: { color: '#253047', fontSize: 14, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#C9D2E0', borderRadius: 10, borderWidth: 1, color: '#172033', fontSize: 16, paddingHorizontal: 13, paddingVertical: 11 },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row' },
  timeField: { flex: 1 },
  timeSpacer: { width: 12 },
  rule: { color: '#657084', fontSize: 12, lineHeight: 18, marginBottom: 13 },
  error: { color: '#B42318', marginBottom: 13 },
  success: { color: '#18713D', marginBottom: 13 },
  button: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 10, paddingVertical: 14 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
