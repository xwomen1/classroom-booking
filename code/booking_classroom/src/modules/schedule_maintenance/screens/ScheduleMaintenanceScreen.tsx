import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { BookingInfo } from '../../booking/components/BookingInfo';
import { getBookings } from '../../booking/services/bookingRepository';
import { getRooms, type Room } from '../../room_management';
import type { MaintenanceRecord } from '../model/maintenance';
import {
  cancelMaintenance,
  createMaintenance,
  getMaintenanceRecords,
} from '../services/maintenanceRepository';

type Props = { username: string; onBack: () => void };

const FLOORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ScheduleMaintenanceScreen({ username, onBack }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof getBookings>>>([]);
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null);
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(tomorrow());
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [roomItems, maintenanceItems, bookingItems] = await Promise.all([
      getRooms(),
      getMaintenanceRecords(),
      getBookings(),
    ]);
    setRooms(roomItems);
    setRoomId(current => roomItems.some(room => room.id === current) ? current : '');
    setMaintenance(maintenanceItems);
    setBookings(
      bookingItems
        .filter(item => item.status === 'APPROVED')
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!roomId) {
      setMessage('Vui lòng mở một tầng và chọn phòng cần bảo trì.');
      return;
    }
    try {
      await createMaintenance({
        roomId,
        date,
        startTime: start,
        endTime: end,
        reason,
        createdBy: username,
      });
      setReason('');
      setMessage('Đã tạo lịch bảo trì.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo lịch bảo trì.');
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelMaintenance(id, username);
      setMessage('Đã hủy lịch bảo trì.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể hủy.');
    }
  };

  return (
    <View style={styles.page}>
      <ScreenHeader title="Lịch phòng và bảo trì" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Tạo lịch bảo trì</Text>
        <Text style={styles.selectorLabel}>Chọn phòng theo tầng</Text>
        <View style={styles.floorList}>
          {FLOORS.map(floor => {
            const floorRooms = rooms
              .filter(room => room.floor === floor)
              .sort((a, b) => a.name.localeCompare(b.name));
            const floorRoomIds = new Set(floorRooms.map(room => room.id));
            const maintenanceRoomCount = new Set(
              maintenance
                .filter(item => !item.cancelledAt && floorRoomIds.has(item.roomId))
                .map(item => item.roomId),
            ).size;
            const selectedRoom = floorRooms.find(room => room.id === roomId);
            const expanded = expandedFloor === floor;

            return (
              <View key={floor} style={styles.floorGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedFloor(current => current === floor ? null : floor)}
                  style={[styles.floorBar, selectedRoom && styles.floorBarSelected]}
                >
                  <View style={styles.floorSummary}>
                    <Text style={styles.floorTitle}>Tầng {floor}</Text>
                    <Text style={styles.floorMeta}>
                      {floorRooms.length} phòng
                      {maintenanceRoomCount > 0 ? ` · ${maintenanceRoomCount} phòng có lịch bảo trì` : ''}
                      {selectedRoom ? ` · Đã chọn ${selectedRoom.name}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.floorArrow}>{expanded ? '⌃' : '⌄'}</Text>
                </Pressable>
                {expanded ? (
                  <View style={styles.roomChoices}>
                    {floorRooms.map(room => (
                      <Choice
                        key={room.id}
                        label={room.name}
                        selected={roomId === room.id}
                        onPress={() => setRoomId(room.id)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Input label="Ngày" value={date} onChangeText={setDate} />
        <View style={styles.timeRow}>
          <View style={styles.half}>
            <Input label="Bắt đầu" value={start} onChangeText={setStart} />
          </View>
          <View style={styles.gap} />
          <View style={styles.half}>
            <Input label="Kết thúc" value={end} onChangeText={setEnd} />
          </View>
        </View>
        <Input label="Lý do" value={reason} onChangeText={setReason} />
        <Pressable style={styles.primary} onPress={add}>
          <Text style={styles.primaryText}>Lên lịch bảo trì</Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.heading}>Lịch bảo trì</Text>
        {maintenance.filter(item => !item.cancelledAt).map(item => (
          <View style={styles.card} key={item.id}>
            <Text style={styles.cardTitle}>
              {rooms.find(room => room.id === item.roomId)?.name ?? item.roomId}
            </Text>
            <Text style={styles.detail}>{item.date} · {item.startTime}–{item.endTime}</Text>
            <Text style={styles.detail}>{item.reason}</Text>
            <Pressable onPress={() => cancel(item.id)}>
              <Text style={styles.cancel}>Hủy lịch bảo trì</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.heading}>Lịch sử dụng phòng đã duyệt</Text>
        {bookings.length ? bookings.map(item => (
          <View style={styles.card} key={item.id}>
            <BookingInfo booking={item} />
          </View>
        )) : <Text style={styles.empty}>Chưa có lịch sử dụng được duyệt.</Text>}
      </ScrollView>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...rest} style={styles.input} />
    </View>
  );
}

function Choice({ label, selected, onPress }: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 40 },
  heading: { color: '#172033', fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 8 },
  selectorLabel: { color: '#344057', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  floorList: { marginBottom: 12 },
  floorGroup: { marginBottom: 7 },
  floorBar: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#CBD4E1',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  floorBarSelected: { borderColor: '#B01432', borderWidth: 2 },
  floorSummary: { flex: 1 },
  floorTitle: { color: '#172033', fontSize: 15, fontWeight: '800' },
  floorMeta: { color: '#657084', fontSize: 11, marginTop: 4 },
  floorArrow: { color: '#B01432', fontSize: 22, fontWeight: '800', marginLeft: 10 },
  roomChoices: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderColor: '#D8E0EA',
    borderTopWidth: 0,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  choice: {
    borderColor: '#B01432',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    marginRight: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceOn: { backgroundColor: '#B01432' },
  choiceText: { color: '#B01432', fontWeight: '700' },
  choiceTextOn: { color: '#FFF' },
  field: { marginBottom: 10 },
  label: { color: '#344057', fontSize: 13, fontWeight: '700', marginBottom: 5 },
  input: {
    backgroundColor: '#FFF',
    borderColor: '#CBD4E1',
    borderRadius: 9,
    borderWidth: 1,
    color: '#172033',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeRow: { flexDirection: 'row' },
  half: { flex: 1 },
  gap: { width: 10 },
  primary: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, paddingVertical: 12 },
  primaryText: { color: '#FFF', fontWeight: '800' },
  message: { backgroundColor: '#EDF5FF', borderRadius: 8, color: '#24598F', marginVertical: 11, padding: 10 },
  card: {
    backgroundColor: '#FFF',
    borderColor: '#E0E6EF',
    borderRadius: 11,
    borderWidth: 1,
    marginBottom: 10,
    padding: 13,
  },
  cardTitle: { color: '#172033', fontSize: 16, fontWeight: '800' },
  detail: { color: '#596579', marginTop: 5 },
  cancel: { color: '#B01432', fontSize: 13, fontWeight: '800', marginTop: 9 },
  empty: { color: '#6B7586' },
});
