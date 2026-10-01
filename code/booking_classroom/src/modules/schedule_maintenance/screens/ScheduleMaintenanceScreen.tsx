import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { BookingInfo } from '../../booking/components/BookingInfo';
import { getBookings } from '../../booking/services/bookingRepository';
import { getRooms, type Room } from '../../room_management';
import type { MaintenanceRecord, MaintenanceRequest } from '../model/maintenance';
import {
  cancelMaintenance,
  createMaintenance,
  getMaintenanceRecords,
  getMaintenanceRequests,
  rejectMaintenanceRequest,
  scheduleMaintenanceFromRequest,
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
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof getBookings>>>([]);
  const [expandedFloors, setExpandedFloors] = useState<number[]>([]);
  const [roomId, setRoomId] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [date, setDate] = useState(tomorrow());
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [roomItems, maintenanceItems, bookingItems, requestItems] = await Promise.all([
      getRooms(),
      getMaintenanceRecords(),
      getBookings(),
      getMaintenanceRequests(),
    ]);
    setRooms(roomItems);
    setRoomId(current => roomItems.some(room => room.id === current) ? current : '');
    setMaintenance(maintenanceItems);
    setRequests(requestItems);
    const requestedFloors = Array.from(new Set(
      requestItems
        .filter(item => item.status === 'PENDING')
        .map(item => roomItems.find(room => room.id === item.roomId)?.floor)
        .filter((floor): floor is number => typeof floor === 'number'),
    ));
    setExpandedFloors(current => Array.from(new Set([...current, ...requestedFloors])));
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
      const input = {
        roomId,
        date,
        startTime: start,
        endTime: end,
        reason,
        createdBy: username,
      };
      if (activeRequestId) await scheduleMaintenanceFromRequest(activeRequestId, input);
      else await createMaintenance(input);
      setReason('');
      setActiveRequestId(null);
      setMessage(activeRequestId ? 'Đã tiếp nhận yêu cầu và tạo lịch bảo trì.' : 'Đã tạo lịch bảo trì.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo lịch bảo trì.');
    }
  };

  const selectRequest = (request: MaintenanceRequest) => {
    const room = rooms.find(item => item.id === request.roomId);
    setActiveRequestId(request.id);
    setRoomId(request.roomId);
    setReason(request.reason);
    if (room) setExpandedFloors(current => Array.from(new Set([...current, room.floor])));
    setMessage(`Đang xử lý yêu cầu của ${request.requesterUsername}. Hãy chọn lịch bảo trì phù hợp.`);
  };

  const rejectRequest = async (request: MaintenanceRequest) => {
    try {
      await rejectMaintenanceRequest(request.id, username, 'Chưa cần lên lịch bảo trì.');
      if (activeRequestId === request.id) setActiveRequestId(null);
      setMessage('Đã từ chối yêu cầu và thông báo cho người dùng.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể từ chối yêu cầu.');
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
        <Text style={styles.heading}>Yêu cầu bảo trì từ người dùng</Text>
        {requests.filter(item => item.status === 'PENDING').length ? requests.filter(item => item.status === 'PENDING').map(item => (
          <View key={item.id} style={styles.requestCard}>
            <Text style={styles.requestBadge}>ĐANG CHỜ XỬ LÝ</Text>
            <Text style={styles.cardTitle}>{rooms.find(room => room.id === item.roomId)?.name ?? item.roomId}</Text>
            <Text style={styles.detail}>{item.requesterUsername} · {new Date(item.requestedAt).toLocaleString('vi-VN')}</Text>
            <Text style={styles.requestReason}>{item.reason}</Text>
            <View style={styles.requestActions}>
              <Pressable style={styles.requestPrimary} onPress={() => selectRequest(item)}><Text style={styles.requestPrimaryText}>Lên lịch xử lý</Text></Pressable>
              <Pressable style={styles.requestSecondary} onPress={() => rejectRequest(item)}><Text style={styles.requestSecondaryText}>Từ chối</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.empty}>Không có yêu cầu bảo trì đang chờ.</Text>}

        <Text style={styles.heading}>Tạo lịch bảo trì</Text>
        {activeRequestId ? <View style={styles.activeRequest}><Text style={styles.activeRequestText}>Đang tạo lịch từ yêu cầu người dùng.</Text><Pressable onPress={() => setActiveRequestId(null)}><Text style={styles.cancel}>Bỏ chọn yêu cầu</Text></Pressable></View> : null}
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
            const pendingRequestRoomIds = new Set(requests.filter(item => item.status === 'PENDING').map(item => item.roomId));
            const requestRoomCount = floorRooms.filter(room => pendingRequestRoomIds.has(room.id)).length;
            const expanded = expandedFloors.includes(floor);

            return (
              <View key={floor} style={styles.floorGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedFloors(current => current.includes(floor) ? current.filter(item => item !== floor) : [...current, floor])}
                  style={[styles.floorBar, selectedRoom && styles.floorBarSelected, requestRoomCount > 0 && styles.floorBarRequested]}
                >
                  <View style={styles.floorSummary}>
                    <Text style={styles.floorTitle}>Tầng {floor}</Text>
                    <Text style={styles.floorMeta}>
                      {floorRooms.length} phòng
                      {maintenanceRoomCount > 0 ? ` · ${maintenanceRoomCount} phòng có lịch bảo trì` : ''}
                      {requestRoomCount > 0 ? ` · ${requestRoomCount} phòng được báo sự cố` : ''}
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
                        requested={pendingRequestRoomIds.has(room.id)}
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

function Choice({ label, selected, requested, onPress }: {
  label: string;
  selected: boolean;
  requested: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, requested && styles.choiceRequested, selected && styles.choiceOn]}>
      <Text style={[styles.choiceText, requested && styles.choiceRequestedText, selected && styles.choiceTextOn]}>{label}{requested ? ' · Có yêu cầu' : ''}</Text>
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
  floorBarRequested: { backgroundColor: '#FFF8D9', borderColor: '#D9A514' },
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
  choiceRequested: { backgroundColor: '#FFE89A', borderColor: '#C58B00' },
  choiceText: { color: '#B01432', fontWeight: '700' },
  choiceRequestedText: { color: '#6F4E00' },
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
  requestCard: { backgroundColor: '#FFF8D9', borderColor: '#D9A514', borderRadius: 11, borderWidth: 1, marginBottom: 10, padding: 13 },
  requestBadge: { color: '#8A5B00', fontSize: 10, fontWeight: '900', marginBottom: 6 },
  requestReason: { color: '#4F421C', fontWeight: '600', lineHeight: 19, marginTop: 7 },
  requestActions: { flexDirection: 'row', marginTop: 10 },
  requestPrimary: { alignItems: 'center', backgroundColor: '#B7791F', borderRadius: 8, flex: 1, marginRight: 7, paddingVertical: 9 },
  requestPrimaryText: { color: '#FFF', fontWeight: '800' },
  requestSecondary: { alignItems: 'center', borderColor: '#B7791F', borderRadius: 8, borderWidth: 1, flex: 1, paddingVertical: 9 },
  requestSecondaryText: { color: '#8A5B00', fontWeight: '800' },
  activeRequest: { backgroundColor: '#FFF8D9', borderRadius: 8, marginBottom: 10, padding: 10 },
  activeRequestText: { color: '#6F4E00', fontWeight: '700' },
  cancel: { color: '#B01432', fontSize: 13, fontWeight: '800', marginTop: 9 },
  empty: { color: '#6B7586' },
});
