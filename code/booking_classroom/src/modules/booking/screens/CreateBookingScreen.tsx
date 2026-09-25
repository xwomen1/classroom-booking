import React, { useEffect, useMemo, useState } from 'react';
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
import { getConfiguration } from '../../configuration/services/configurationRepository';
import { getRooms } from '../../room_management/services/roomRepository';
import type { Room } from '../../room_management/model/room';
import { BookingTimePicker, buildDateOptions } from '../components/BookingTimePicker';
import { getBookingDraftSelection } from '../services/bookingDraftRepository';
import { createBooking } from '../services/bookingRepository';

type Props = { username: string; onBack: () => void };

export function CreateBookingScreen({ username, onBack }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomQuery, setRoomQuery] = useState('');
  const [roomId, setRoomId] = useState('');
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [purpose, setPurpose] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [marked, setMarked] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getRooms(), getConfiguration(), getBookingDraftSelection(username)]).then(
      ([roomItems, config, draft]) => {
        const available = roomItems.filter(room => room.status === 'AVAILABLE');
        setRooms(available);
        const options = buildDateOptions(config.minAdvanceDays, config.maxAdvanceDays);
        setDateOptions(options);
        setRuleText(`Đặt trước từ ${config.minAdvanceDays} đến ${config.maxAdvanceDays} ngày; tối đa ${config.maxActiveBookingsPerUser} yêu cầu đang hoạt động.`);
        if (draft && available.some(room => room.id === draft.roomId)) {
          const room = available.find(item => item.id === draft.roomId)!;
          setRoomId(room.id);
          setRoomQuery(room.name);
          setDate(draft.date);
          setStartTime(draft.startTime);
          setEndTime(draft.endTime);
          setMarked(true);
        } else {
          setDate(options[0]);
        }
      },
    );
  }, [username]);

  const selectedRoom = rooms.find(room => room.id === roomId);
  const suggestions = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return [];
    return rooms.filter(room =>
      `${room.name} ${room.location}`.toLowerCase().includes(query),
    ).slice(0, 6);
  }, [roomQuery, rooms]);

  const chooseRoom = (room: Room) => {
    setRoomId(room.id);
    setRoomQuery(room.name);
    setMarked(false);
  };

  const changeRoomQuery = (value: string) => {
    setRoomQuery(value);
    if (selectedRoom?.name.toLowerCase() !== value.trim().toLowerCase()) setRoomId('');
    setMarked(false);
  };

  const submit = async () => {
    if (!roomId) {
      setIsError(true);
      setMessage('Hãy nhập tên rồi chọn đúng một phòng trong danh sách gợi ý.');
      return;
    }
    setSaving(true);
    try {
      await createBooking({ requesterUsername: username, roomId, date, startTime, endTime, purpose });
      setIsError(false);
      setMessage('Đã gửi yêu cầu. Admin duyệt booking sẽ đồng thời cấp quyền tự tạo mã nếu đây là phòng khóa số.');
      setPurpose('');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể tạo yêu cầu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <ScreenHeader title="Đặt phòng" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {marked && selectedRoom ? (
          <View style={styles.markedBox}>
            <Text style={styles.markedLabel}>PHÒNG ĐÃ ĐÁNH DẤU TỪ SƠ ĐỒ</Text>
            <Text style={styles.markedRoom}>{selectedRoom.name} · Tầng {selectedRoom.floor}</Text>
            <Text style={styles.markedTime}>{date} · {startTime}–{endTime}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Chọn phòng</Text>
        <Field label="Nhập tên phòng" value={roomQuery} onChangeText={changeRoomQuery} placeholder="Ví dụ: A101" autoCapitalize="characters" />
        {suggestions.length > 0 && (!selectedRoom || roomQuery !== selectedRoom.name) ? (
          <View style={styles.suggestions}>
            {suggestions.map(room => (
              <Pressable key={room.id} onPress={() => chooseRoom(room)} style={styles.suggestion}>
                <Text style={styles.suggestionName}>{room.name}</Text>
                <Text style={styles.suggestionDetail}>Tầng {room.floor} · {room.capacity} chỗ · {room.equipment.join(', ')}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {selectedRoom ? (
          <View style={styles.selectedRoom}>
            <Text style={styles.roomName}>{selectedRoom.name}</Text>
            <Text style={styles.roomDetail}>{selectedRoom.location} · {selectedRoom.capacity} người</Text>
            <Text style={styles.roomDetail}>{selectedRoom.equipment.join(', ')}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Thời gian và mục đích</Text>
        <BookingTimePicker
          dateOptions={dateOptions}
          date={date}
          startTime={startTime}
          endTime={endTime}
          onDateChange={setDate}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
        />
        <Field label="Mục đích sử dụng" multiline onChangeText={setPurpose} placeholder="Ví dụ: Họp nhóm đồ án" value={purpose} />
        <Text style={styles.rule}>{ruleText}</Text>
        {message ? <Text style={isError ? styles.error : styles.success}>{message}</Text> : null}
        <Pressable disabled={saving} onPress={submit} style={({ pressed }) => [styles.button, (pressed || saving) && styles.pressed]} testID="booking-submit">
          <Text style={styles.buttonText}>{saving ? 'Đang gửi...' : 'Gửi yêu cầu đặt phòng'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...props }: FieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#7D8795" style={[styles.input, props.multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 }, content: { padding: 20, paddingBottom: 36 },
  markedBox: { backgroundColor: '#EAF4FF', borderColor: '#6B9BC7', borderRadius: 11, borderWidth: 1, marginBottom: 15, padding: 12 }, markedLabel: { color: '#315A86', fontSize: 10, fontWeight: '900' }, markedRoom: { color: '#172033', fontSize: 17, fontWeight: '900', marginTop: 5 }, markedTime: { color: '#315A86', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#253047', fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  field: { marginBottom: 12 }, label: { color: '#253047', fontSize: 14, fontWeight: '700', marginBottom: 7 }, input: { backgroundColor: '#FFF', borderColor: '#C9D2E0', borderRadius: 10, borderWidth: 1, color: '#172033', fontSize: 16, paddingHorizontal: 13, paddingVertical: 11 }, multiline: { minHeight: 82, textAlignVertical: 'top' },
  suggestions: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, marginBottom: 12, marginTop: -7, overflow: 'hidden' }, suggestion: { borderBottomColor: '#EDF0F4', borderBottomWidth: 1, padding: 10 }, suggestionName: { color: '#172033', fontWeight: '800' }, suggestionDetail: { color: '#657084', fontSize: 11, marginTop: 3 },
  selectedRoom: { backgroundColor: '#FFF', borderColor: '#B01432', borderRadius: 10, borderWidth: 2, marginBottom: 14, padding: 12 }, roomName: { color: '#172033', fontSize: 17, fontWeight: '900' }, roomDetail: { color: '#657084', fontSize: 12, marginTop: 4 },
  rule: { color: '#657084', fontSize: 12, lineHeight: 18, marginBottom: 13 }, error: { color: '#B42318', marginBottom: 13 }, success: { color: '#18713D', marginBottom: 13 },
  button: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 10, paddingVertical: 14 }, buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' }, pressed: { opacity: 0.7 },
});
