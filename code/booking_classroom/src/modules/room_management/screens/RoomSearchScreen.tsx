import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { BookingTimePicker, buildDateOptions } from '../../booking/components/BookingTimePicker';
import { createBooking, getBookings } from '../../booking/services/bookingRepository';
import { getConfiguration } from '../../configuration/services/configurationRepository';
import { hasMaintenanceConflict } from '../../schedule_maintenance/services/maintenanceRepository';
import type { LockType, Room } from '../model/room';
import { getRooms } from '../services/roomRepository';

type Props = { username: string; onBack: () => void };
type MapStatus = 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE' | 'FILTERED';
type MapRoom = Room & { mapStatus: MapStatus };
const MAP_ROWS: ReadonlyArray<ReadonlyArray<number | null>> = [
  [0, null, 1],
  [2, null, 3],
  [4, 5, 6],
];

export function RoomSearchScreen({ username, onBack }: Props) {
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [floor, setFloor] = useState(1);
  const [roomQuery, setRoomQuery] = useState('');
  const [capacity, setCapacity] = useState('');
  const [equipment, setEquipment] = useState('');
  const [lockType, setLockType] = useState<LockType | 'ALL'>('ALL');
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [rooms, setRooms] = useState<MapRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getConfiguration(), getRooms()]).then(([config, roomItems]) => {
      const options = buildDateOptions(config.minAdvanceDays, config.maxAdvanceDays);
      setDateOptions(options);
      setDate(current => current || options[0]);
      setAllRooms(roomItems);
    });
  }, []);

  const refreshMap = useCallback(async () => {
    if (!date) return;
    const roomItems = await getRooms();
    setAllRooms(roomItems);
    const candidates = roomItems
      .filter(room => room.floor === floor)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 7);
    const bookings = await getBookings();
    const mapped = await Promise.all(candidates.map(async room => {
      const matchesFilter =
        (!Number(capacity) || room.capacity >= Number(capacity)) &&
        (!equipment.trim() || room.equipment.some(item => item.toLowerCase().includes(equipment.trim().toLowerCase()))) &&
        (lockType === 'ALL' || room.lockType === lockType);
      const booked = bookings.some(item =>
        ['PENDING', 'APPROVED'].includes(item.status) &&
        item.roomId === room.id &&
        item.date === date &&
        startTime < item.endTime &&
        endTime > item.startTime,
      );
      const maintenance = room.status === 'MAINTENANCE' ||
        await hasMaintenanceConflict(room.id, date, startTime, endTime);
      return {
        ...room,
        mapStatus: !matchesFilter ? 'FILTERED' : maintenance ? 'MAINTENANCE' : booked ? 'BOOKED' : 'AVAILABLE',
      } as MapRoom;
    }));
    setRooms(mapped);
    setSelectedId(current => mapped.some(room => room.id === current) ? current : null);
    const available = mapped.filter(room => room.mapStatus === 'AVAILABLE').length;
    setIsError(false);
    setMessage(`Tầng ${floor}: ${available}/${mapped.length} phòng phù hợp đang trống.`);
  }, [capacity, date, endTime, equipment, floor, lockType, startTime]);

  useEffect(() => { refreshMap(); }, [refreshMap]);

  const selected = useMemo(() => rooms.find(room => room.id === selectedId), [rooms, selectedId]);
  const roomSuggestions = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return [];
    return allRooms.filter(room => room.name.toLowerCase().includes(query)).slice(0, 6);
  }, [allRooms, roomQuery]);

  const selectRoom = (room: Room) => {
    setFloor(room.floor);
    setSelectedId(room.id);
    setRoomQuery(room.name);
    setIsError(false);
    setMessage(`Đã chọn ${room.name}. Kiểm tra trạng thái trên sơ đồ rồi nhập mục đích để đặt.`);
  };

  const submitBooking = async () => {
    if (!selected || selected.mapStatus !== 'AVAILABLE') {
      setIsError(true);
      setMessage('Hãy chọn một phòng đang trống và phù hợp bộ lọc.');
      return;
    }
    setSaving(true);
    try {
      await createBooking({
        requesterUsername: username,
        roomId: selected.id,
        date,
        startTime,
        endTime,
        purpose,
      });
      const bookedRoomName = selected.name;
      setPurpose('');
      await refreshMap();
      setIsError(false);
      setMessage(`Đã gửi yêu cầu đặt phòng ${bookedRoomName}. Phòng được chuyển sang trạng thái đã đặt trong khung giờ này.`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể tạo yêu cầu đặt phòng.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.page}>
      <ScreenHeader title="Tìm và đặt phòng" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Nhập nhanh tên phòng</Text>
        <Input
          label="Tên phòng"
          value={roomQuery}
          onChangeText={value => { setRoomQuery(value); setSelectedId(null); }}
          placeholder="Ví dụ: A101"
          autoCapitalize="characters"
        />
        {roomSuggestions.length > 0 && roomQuery !== selected?.name ? (
          <View style={styles.suggestions}>
            {roomSuggestions.map(room => (
              <Pressable key={room.id} onPress={() => selectRoom(room)} style={styles.suggestion}>
                <Text style={styles.suggestionName}>{room.name}</Text>
                <Text style={styles.suggestionDetail}>Tầng {room.floor} · {room.capacity} chỗ · {room.equipment.join(', ')}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Khoảng thời gian</Text>
        <BookingTimePicker
          dateOptions={dateOptions}
          date={date}
          startTime={startTime}
          endTime={endTime}
          onDateChange={setDate}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
        />
        <Text style={styles.sectionTitle}>Bộ lọc phòng</Text>
        <View style={styles.filterRow}>
          <View style={styles.half}><Input label="Sức chứa tối thiểu" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" /></View>
          <View style={styles.gap} />
          <View style={styles.half}><Input label="Thiết bị cần có" value={equipment} onChangeText={setEquipment} /></View>
        </View>
        <View style={styles.choices}>
          <Choice label="Mọi khóa" selected={lockType === 'ALL'} onPress={() => setLockType('ALL')} />
          <Choice label="Mã số" selected={lockType === 'PIN_CODE'} onPress={() => setLockType('PIN_CODE')} />
          <Choice label="Cơ/thẻ" selected={lockType === 'PHYSICAL_KEY'} onPress={() => setLockType('PHYSICAL_KEY')} />
        </View>

        <View style={styles.legend}>
          <Legend color="#DDF4E7" label="Trống" />
          <Legend color="#FBE1E4" label="Đã đặt" />
          <Legend color="#ECEEF2" label="Bảo trì" />
          <Legend color="#FFF" label="Không khớp lọc" />
        </View>
        <Text style={isError ? styles.errorMessage : styles.message}>{message}</Text>

        <View style={styles.mapSection}>
          <View style={styles.floorRail}>
            <Text style={styles.building}>TÒA A</Text>
            {[8, 7, 6, 5, 4, 3, 2, 1].map(item => (
              <Pressable key={item} onPress={() => { setFloor(item); setSelectedId(null); }} style={[styles.floorButton, floor === item && styles.floorButtonOn]}>
                <Text style={[styles.floorText, floor === item && styles.floorTextOn]}>T{item}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.mapArea}>
            <Text style={styles.mapTitle}>SƠ ĐỒ CHỮ U · TẦNG {floor}</Text>
            {MAP_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.mapRow}>
                {row.map((roomIndex, columnIndex) => {
                  if (roomIndex === null) return <View key={`empty-${columnIndex}`} style={styles.mapGap} />;
                  const room = rooms[roomIndex];
                  if (!room) return <View key={`missing-${columnIndex}`} style={styles.mapRoomPlaceholder} />;
                  return <RoomCell key={room.id} room={room} selected={selectedId === room.id} onPress={() => selectRoom(room)} />;
                })}
              </View>
            ))}
          </View>
        </View>

        {selected ? (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedTitle}>{selected.name} · {statusLabel(selected.mapStatus)}</Text>
            <Text style={styles.selectedDetail}>{selected.capacity} chỗ · {selected.equipment.join(', ')}</Text>
            <Text style={styles.selectedDetail}>{selected.lockType === 'PIN_CODE' ? 'Khóa mã số online' : 'Khóa cơ / thẻ từ'}</Text>
            <View style={styles.purposeField}>
              <Input
                label="Mục đích sử dụng"
                value={purpose}
                onChangeText={setPurpose}
                placeholder="Ví dụ: Họp nhóm đồ án"
                multiline
              />
            </View>
            <Pressable
              disabled={saving || selected.mapStatus !== 'AVAILABLE'}
              onPress={submitBooking}
              style={[styles.bookButton, (saving || selected.mapStatus !== 'AVAILABLE') && styles.disabled]}
              testID="merged-booking-submit"
            >
              <Text style={styles.bookText}>{saving ? 'Đang gửi...' : `Đặt phòng ${selected.name}`}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.selectHint}>Chọn một phòng trên sơ đồ hoặc nhập tên phòng để đặt ngay.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function statusLabel(status: MapStatus) {
  return status === 'AVAILABLE' ? 'Đang trống' : status === 'BOOKED' ? 'Đã có người đặt' : status === 'MAINTENANCE' ? 'Bảo trì' : 'Không khớp bộ lọc';
}
function RoomCell({ room, selected, onPress }: { room: MapRoom; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[
      styles.roomCell,
      room.mapStatus === 'AVAILABLE' ? styles.available : room.mapStatus === 'BOOKED' ? styles.booked : room.mapStatus === 'MAINTENANCE' ? styles.maintenance : styles.filtered,
      selected && styles.roomSelected,
    ]}>
      <Text style={styles.roomName}>{room.name}</Text>
      <Text style={styles.roomMeta}>{room.capacity} chỗ</Text>
      <Text numberOfLines={2} style={styles.roomEquipment}>{room.equipment.join(', ')}</Text>
    </Pressable>
  );
}
function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return <View><Text style={styles.inputLabel}>{label}</Text><TextInput {...rest} placeholderTextColor="#7D8795" style={[styles.input, props.multiline && styles.multiline]} /></View>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}><Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text></Pressable>;
}
function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 14, paddingBottom: 40 },
  sectionTitle: { color: '#172033', fontSize: 16, fontWeight: '800', marginBottom: 9, marginTop: 5 },
  filterRow: { flexDirection: 'row' }, half: { flex: 1 }, gap: { width: 9 }, inputLabel: { color: '#344057', fontSize: 11, fontWeight: '700', marginBottom: 5 },
  input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 8, borderWidth: 1, color: '#172033', paddingHorizontal: 9, paddingVertical: 9 }, multiline: { minHeight: 76, textAlignVertical: 'top' },
  suggestions: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, marginBottom: 12, marginTop: 5, overflow: 'hidden' }, suggestion: { borderBottomColor: '#EDF0F4', borderBottomWidth: 1, padding: 10 }, suggestionName: { color: '#172033', fontWeight: '800' }, suggestionDetail: { color: '#657084', fontSize: 11, marginTop: 3 },
  choices: { flexDirection: 'row', marginBottom: 9, marginTop: 9 }, choice: { borderColor: '#386E9F', borderRadius: 8, borderWidth: 1, marginRight: 6, paddingHorizontal: 10, paddingVertical: 7 }, choiceOn: { backgroundColor: '#386E9F' }, choiceText: { color: '#386E9F', fontSize: 11, fontWeight: '700' }, choiceTextOn: { color: '#FFF' },
  legend: { flexDirection: 'row', justifyContent: 'center', marginTop: 5 }, legendItem: { alignItems: 'center', flexDirection: 'row', marginHorizontal: 6 }, legendColor: { borderColor: '#BFC7D2', borderRadius: 3, borderWidth: 1, height: 13, marginRight: 4, width: 13 }, legendText: { color: '#596579', fontSize: 11 }, message: { color: '#315A86', fontSize: 12, marginVertical: 9, textAlign: 'center' }, errorMessage: { color: '#B42318', fontSize: 12, marginVertical: 9, textAlign: 'center' },
  mapSection: { alignItems: 'stretch', flexDirection: 'row' }, floorRail: { backgroundColor: '#FFF', borderColor: '#CAD4E0', borderRadius: 12, borderWidth: 1, marginRight: 8, overflow: 'hidden', width: 53 }, building: { color: '#315A86', fontSize: 10, fontWeight: '900', paddingVertical: 7, textAlign: 'center' }, floorButton: { alignItems: 'center', borderTopColor: '#E4E8EF', borderTopWidth: 1, paddingVertical: 8 }, floorButtonOn: { backgroundColor: '#1769AA' }, floorText: { color: '#344057', fontSize: 12, fontWeight: '800' }, floorTextOn: { color: '#FFF' },
  mapArea: { backgroundColor: '#EAF0F7', borderColor: '#AAB8C8', borderRadius: 13, borderWidth: 1, flex: 1, padding: 7 }, mapTitle: { color: '#344057', fontSize: 11, fontWeight: '900', marginBottom: 7, textAlign: 'center' }, mapRow: { flexDirection: 'row', marginBottom: 6 }, mapGap: { flex: 0.75 }, mapRoomPlaceholder: { flex: 1, minHeight: 72 },
  roomCell: { borderColor: '#AAB8C8', borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 76, padding: 6 }, available: { backgroundColor: '#DDF4E7' }, booked: { backgroundColor: '#FBE1E4' }, maintenance: { backgroundColor: '#ECEEF2' }, filtered: { backgroundColor: '#FFF', opacity: 0.45 }, roomSelected: { borderColor: '#1769AA', borderWidth: 3 }, roomName: { color: '#172033', fontSize: 12, fontWeight: '900' }, roomMeta: { color: '#4F5B6E', fontSize: 10, marginTop: 2 }, roomEquipment: { color: '#657084', fontSize: 9, marginTop: 2 },
  selectedBox: { backgroundColor: '#FFF', borderColor: '#D6DDE8', borderRadius: 11, borderWidth: 1, marginTop: 12, padding: 12 }, selectedTitle: { color: '#172033', fontSize: 16, fontWeight: '900' }, selectedDetail: { color: '#596579', fontSize: 12, marginTop: 4 }, purposeField: { marginTop: 12 }, bookButton: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 8, marginTop: 10, paddingVertical: 11 }, bookText: { color: '#FFF', fontWeight: '800' }, disabled: { opacity: 0.4 }, selectHint: { backgroundColor: '#EAF4FF', borderRadius: 9, color: '#315A86', marginTop: 12, padding: 11, textAlign: 'center' },
});
