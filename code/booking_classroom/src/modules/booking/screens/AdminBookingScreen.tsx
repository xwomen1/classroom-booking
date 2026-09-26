import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { createTemporaryPin } from '../../access_control';
import { getRooms, type Room } from '../../room_management';
import type { MaintenanceRecord } from '../../schedule_maintenance/model/maintenance';
import { getMaintenanceRecords, periodsOverlap } from '../../schedule_maintenance/services/maintenanceRepository';
import { BookingInfo } from '../components/BookingInfo';
import type { Booking } from '../model/booking';
import { changeBookingRoom, getBookings, meetsReplacementRoomRequirements, reviewBooking, scheduleKeyPickup } from '../services/bookingRepository';

type PickupDraft = { date: string; time: string; location: string };
type ChangeDraft = { roomId: string; reason: string };
const FLOORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export function AdminBookingScreen({ username, onBack }: { username: string; onBack: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]); const [message, setMessage] = useState(''); const [filter, setFilter] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [pickups, setPickups] = useState<Record<string, PickupDraft>>({}); const [changes, setChanges] = useState<Record<string, ChangeDraft>>({}); const [expandedChangeFloors, setExpandedChangeFloors] = useState<Record<string, number | null>>({});
  const load = useCallback(async () => { const [items, roomItems, maintenanceItems] = await Promise.all([getBookings(), getRooms(), getMaintenanceRecords()]); setBookings([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setRooms(roomItems); setMaintenance(maintenanceItems); }, []);
  useEffect(() => { load(); }, [load]);
  const action = async (operation: () => Promise<unknown>, success: string) => { try { await operation(); setMessage(success); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.'); } };
  const setPickup = (id: string, field: keyof PickupDraft, value: string) => setPickups(current => ({ ...current, [id]: { ...(current[id] ?? { date: '', time: '', location: '' }), [field]: value } }));
  const setChange = (id: string, field: keyof ChangeDraft, value: string) => setChanges(current => ({ ...current, [id]: { ...(current[id] ?? { roomId: '', reason: '' }), [field]: value } }));
  const toggleChangeFloor = (bookingId: string, floor: number) => setExpandedChangeFloors(current => ({ ...current, [bookingId]: current[bookingId] === floor ? null : floor }));
  const visible = bookings.filter(item => {
    const ended = new Date(`${item.date}T${item.endTime}:00`) <= new Date();
    return filter === 'ACTIVE'
      ? ['PENDING', 'APPROVED'].includes(item.status) && !ended
      : ['REJECTED', 'CANCELLED'].includes(item.status) || ended;
  });
  return <View style={styles.page}><ScreenHeader title="Yêu cầu đặt phòng" onBack={onBack} /><View style={styles.tabs}><Tab label="Đang xử lý" on={filter === 'ACTIVE'} onPress={() => setFilter('ACTIVE')} /><Tab label="Đã đóng" on={filter === 'HISTORY'} onPress={() => setFilter('HISTORY')} /></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {message ? <Text style={styles.message}>{message}</Text> : null}{visible.length === 0 ? <Text style={styles.empty}>Không có yêu cầu trong nhóm này.</Text> : visible.map(booking => {
      const room = rooms.find(item => item.id === booking.roomId); const pickup = pickups[booking.id] ?? { date: booking.date, time: '', location: '' }; const change = changes[booking.id] ?? { roomId: '', reason: '' }; const activePin = booking.temporaryPin && !booking.temporaryPin.revokedAt;
      const replacementRooms = room ? getReplacementCandidates(room, booking, rooms, bookings, maintenance) : [];
      const replacementRoom = replacementRooms.find(item => item.id === change.roomId);
      const expandedChangeFloor = expandedChangeFloors[booking.id] ?? null;
      return <View key={booking.id} style={styles.card}><BookingInfo booking={booking} />
        {booking.status === 'PENDING' ? <View style={styles.row}><Button label="Duyệt" primary onPress={() => action(() => reviewBooking(booking.id, 'APPROVED', username), 'Đã duyệt yêu cầu.')} /><Button label="Từ chối" onPress={() => action(() => reviewBooking(booking.id, 'REJECTED', username), 'Đã từ chối yêu cầu.')} /></View> : null}
        {booking.status === 'APPROVED' && room?.lockType === 'PIN_CODE' && !activePin ? <View style={styles.section}><Text style={styles.sectionTitle}>Mã mở cửa</Text><Text style={styles.detail}>Người đặt đã được quyền tự tạo mã cho phòng này. Bạn cũng có thể tạo mã thay.</Text><Pressable style={styles.purple} onPress={() => action(() => createTemporaryPin(booking.id, username, 'admin'), 'Đã tạo mã tạm thời.')}><Text style={styles.white}>Tạo mã thay</Text></Pressable></View> : null}
        {activePin ? <View style={styles.pinBox}><Text style={styles.pinLabel}>Mật khẩu tạm thời</Text><Text style={styles.pinCode}>{booking.temporaryPin!.code}</Text><Text style={styles.detail}>Tạo bởi {booking.temporaryPin!.createdBy}</Text></View> : null}
        {booking.status === 'APPROVED' && room?.lockType === 'PHYSICAL_KEY' ? <View style={styles.section}><Text style={styles.sectionTitle}>Hẹn nhận khóa / thẻ</Text><Input placeholder="Ngày YYYY-MM-DD" value={pickup.date} onChangeText={value => setPickup(booking.id, 'date', value)} /><Input placeholder="Giờ HH:mm" value={pickup.time} onChangeText={value => setPickup(booking.id, 'time', value)} /><Input placeholder="Địa điểm nhận khóa" value={pickup.location} onChangeText={value => setPickup(booking.id, 'location', value)} /><Pressable style={styles.outlineBlue} onPress={() => action(() => scheduleKeyPickup(booking.id, username, pickup.date, pickup.time, pickup.location), 'Đã tạo lịch hẹn nhận khóa.')}><Text style={styles.blueText}>Lưu lịch hẹn</Text></Pressable></View> : null}
        {booking.status === 'APPROVED' && room ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đổi phòng khi có việc cấp thiết</Text>
          <Text style={styles.replacementRule}>Chỉ hiện phòng cùng loại khóa, đủ sức chứa, đủ thiết bị và không trùng lịch.</Text>
          <ReplacementRoomSelector
            currentRoom={room}
            candidates={replacementRooms}
            selectedRoomId={change.roomId}
            expandedFloor={expandedChangeFloor}
            onToggleFloor={floor => toggleChangeFloor(booking.id, floor)}
            onSelect={candidate => setChange(booking.id, 'roomId', candidate.id)}
          />
          {replacementRoom ? <RoomComparison currentRoom={room} replacementRoom={replacementRoom} /> : null}
          <Input placeholder="Lý do bắt buộc" value={change.reason} onChangeText={value => setChange(booking.id, 'reason', value)} />
          <Pressable
            disabled={!replacementRoom}
            style={[styles.outlineBlue, !replacementRoom && styles.disabled]}
            onPress={() => action(async () => {
              await changeBookingRoom(booking.id, change.roomId, username, change.reason);
              setChanges(current => ({ ...current, [booking.id]: { roomId: '', reason: '' } }));
              setExpandedChangeFloors(current => ({ ...current, [booking.id]: null }));
            }, 'Đã đổi phòng và gửi thông báo.')}
          >
            <Text style={styles.blueText}>Xác nhận đổi phòng</Text>
          </Pressable>
        </View> : null}
      </View>;
    })}
  </ScrollView></View>;
}

function getReplacementCandidates(
  currentRoom: Room,
  booking: Booking,
  rooms: Room[],
  bookings: Booking[],
  maintenance: MaintenanceRecord[],
) {
  return rooms
    .filter(candidate => meetsReplacementRoomRequirements(currentRoom, candidate))
    .filter(candidate => !maintenance.some(item =>
      !item.cancelledAt &&
      item.roomId === candidate.id &&
      periodsOverlap(item.date, item.startTime, item.endTime, booking.date, booking.startTime, booking.endTime),
    ))
    .filter(candidate => !bookings.some(item =>
      item.id !== booking.id &&
      ['PENDING', 'APPROVED'].includes(item.status) &&
      item.roomId === candidate.id &&
      periodsOverlap(item.date, item.startTime, item.endTime, booking.date, booking.startTime, booking.endTime),
    ))
    .sort((a, b) => {
      const sameFloorDifference = Number(b.floor === currentRoom.floor) - Number(a.floor === currentRoom.floor);
      if (sameFloorDifference !== 0) return sameFloorDifference;
      const capacityDifference = (a.capacity - currentRoom.capacity) - (b.capacity - currentRoom.capacity);
      if (capacityDifference !== 0) return capacityDifference;
      const equipmentDifference = (a.equipment.length - currentRoom.equipment.length) -
        (b.equipment.length - currentRoom.equipment.length);
      if (equipmentDifference !== 0) return equipmentDifference;
      return a.name.localeCompare(b.name);
    });
}

function ReplacementRoomSelector({
  currentRoom,
  candidates,
  selectedRoomId,
  expandedFloor,
  onToggleFloor,
  onSelect,
}: {
  currentRoom: Room;
  candidates: Room[];
  selectedRoomId: string;
  expandedFloor: number | null;
  onToggleFloor: (floor: number) => void;
  onSelect: (room: Room) => void;
}) {
  return <View style={styles.replacementFloors}>
    <View style={styles.currentRoomBox}>
      <Text style={styles.currentRoomLabel}>Phòng hiện tại</Text>
      <Text style={styles.currentRoomName}>{currentRoom.name} · {currentRoom.capacity} chỗ</Text>
      <Text style={styles.detail}>{lockLabel(currentRoom)} · {currentRoom.equipment.join(', ')}</Text>
    </View>
    {candidates.length === 0 ? <Text style={styles.noReplacement}>Không có phòng thay thế đáp ứng đủ điều kiện.</Text> : null}
    {FLOORS.map(floor => {
      const floorRooms = candidates.filter(room => room.floor === floor);
      const expanded = expandedFloor === floor;
      const disabled = floorRooms.length === 0;
      const containsSelected = floorRooms.some(room => room.id === selectedRoomId);
      return <View key={floor} style={styles.replacementFloorGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled, expanded }}
          disabled={disabled}
          onPress={() => onToggleFloor(floor)}
          style={[
            styles.replacementFloorBar,
            containsSelected && styles.replacementFloorSelected,
            disabled && styles.replacementFloorDisabled,
          ]}
        >
          <View style={styles.replacementFloorSummary}>
            <Text style={[styles.replacementFloorTitle, disabled && styles.mutedText]}>Tầng {floor}</Text>
            <Text style={styles.replacementFloorMeta}>
              {floorRooms.length > 0 ? `${floorRooms.length} phòng phù hợp` : 'Không có phòng phù hợp'}
            </Text>
          </View>
          <Text style={[styles.replacementFloorArrow, disabled && styles.mutedText]}>
            {disabled ? '—' : expanded ? '⌃' : '⌄'}
          </Text>
        </Pressable>
        {expanded && floorRooms.length > 0 ? <View style={styles.replacementRoomList}>
          {floorRooms.map(room => <Pressable
            key={room.id}
            onPress={() => onSelect(room)}
            style={[styles.replacementRoom, selectedRoomId === room.id && styles.replacementRoomOn]}
          >
            <View style={styles.replacementRoomHeader}>
              <Text style={[styles.replacementRoomName, selectedRoomId === room.id && styles.white]}>{room.name}</Text>
              <Text style={[styles.replacementRoomCapacity, selectedRoomId === room.id && styles.white]}>{room.capacity} chỗ</Text>
            </View>
            <Text style={[styles.replacementRoomDetail, selectedRoomId === room.id && styles.white]}>
              {lockLabel(room)} · {room.equipment.join(', ')}
            </Text>
          </Pressable>)}
        </View> : null}
      </View>;
    })}
  </View>;
}

function RoomComparison({ currentRoom, replacementRoom }: { currentRoom: Room; replacementRoom: Room }) {
  return <View style={styles.comparison}>
    <Text style={styles.comparisonTitle}>So sánh trước khi đổi</Text>
    <ComparisonRow label="Phòng" current={currentRoom.name} replacement={replacementRoom.name} />
    <ComparisonRow label="Sức chứa" current={`${currentRoom.capacity} chỗ`} replacement={`${replacementRoom.capacity} chỗ`} />
    <ComparisonRow label="Loại khóa" current={lockLabel(currentRoom)} replacement={lockLabel(replacementRoom)} />
    <ComparisonRow label="Thiết bị" current={currentRoom.equipment.join(', ')} replacement={replacementRoom.equipment.join(', ')} />
  </View>;
}

function ComparisonRow({ label, current, replacement }: { label: string; current: string; replacement: string }) {
  return <View style={styles.comparisonRow}>
    <Text style={styles.comparisonLabel}>{label}</Text>
    <Text style={styles.comparisonValue}>{current}</Text>
    <Text style={styles.comparisonArrow}>→</Text>
    <Text style={styles.comparisonValue}>{replacement}</Text>
  </View>;
}

function lockLabel(room: Room) {
  return room.lockType === 'PIN_CODE' ? 'Khóa mã số' : 'Khóa cơ/thẻ';
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, on && styles.tabOn]}><Text style={[styles.tabText, on && styles.white]}>{label}</Text></Pressable>; }
function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) { return <Pressable onPress={onPress} style={[styles.button, primary && styles.buttonPrimary]}><Text style={[styles.buttonText, primary && styles.white]}>{label}</Text></Pressable>; }
function Input(props: React.ComponentProps<typeof TextInput>) { return <TextInput {...props} placeholderTextColor="#7D8795" style={styles.input} />; }
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' },
  tabs: { backgroundColor: '#FFF', flexDirection: 'row', padding: 8 },
  tab: { alignItems: 'center', borderRadius: 8, flex: 1, paddingVertical: 9 },
  tabOn: { backgroundColor: '#B01432' },
  tabText: { color: '#657084', fontWeight: '800' },
  content: { padding: 18, paddingBottom: 40 },
  message: { backgroundColor: '#EDF5FF', borderRadius: 9, color: '#24598F', marginBottom: 12, padding: 11 },
  empty: { color: '#657084', marginTop: 40, textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderColor: '#E1E6EE', borderRadius: 13, borderWidth: 1, marginBottom: 14, padding: 15 },
  row: { flexDirection: 'row', marginTop: 13 },
  button: { alignItems: 'center', borderColor: '#B01432', borderRadius: 8, borderWidth: 1, flex: 1, marginRight: 7, paddingVertical: 10 },
  buttonPrimary: { backgroundColor: '#B01432' },
  buttonText: { color: '#B01432', fontWeight: '800' },
  white: { color: '#FFF', fontWeight: '800' },
  section: { backgroundColor: '#F7F9FC', borderRadius: 9, marginTop: 12, padding: 11 },
  sectionTitle: { color: '#344057', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  purple: { alignItems: 'center', backgroundColor: '#5A3788', borderRadius: 8, paddingVertical: 10 },
  outlinePurple: { alignItems: 'center', borderColor: '#5A3788', borderRadius: 8, borderWidth: 1, marginTop: 7, paddingVertical: 9 },
  purpleText: { color: '#5A3788', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pinBox: { backgroundColor: '#F4F0FF', borderRadius: 9, marginTop: 12, padding: 11 },
  pinLabel: { color: '#5C4778', fontWeight: '800' },
  pinCode: { color: '#3B235F', fontSize: 24, fontWeight: '900', letterSpacing: 4, marginTop: 5 },
  detail: { color: '#657084', fontSize: 12, marginTop: 5 },
  input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 8, borderWidth: 1, color: '#172033', marginBottom: 7, paddingHorizontal: 10, paddingVertical: 9 },
  outlineBlue: { alignItems: 'center', borderColor: '#386E9F', borderRadius: 8, borderWidth: 1, paddingVertical: 9 },
  blueText: { color: '#315A86', fontWeight: '800' },
  replacementRule: { color: '#657084', fontSize: 12, lineHeight: 18, marginBottom: 9 },
  replacementFloors: { marginBottom: 10 },
  currentRoomBox: { backgroundColor: '#EAF2FA', borderRadius: 8, marginBottom: 8, padding: 10 },
  currentRoomLabel: { color: '#657084', fontSize: 11, fontWeight: '700' },
  currentRoomName: { color: '#172033', fontSize: 14, fontWeight: '800', marginTop: 3 },
  noReplacement: { backgroundColor: '#FFF3E8', borderRadius: 8, color: '#8A4B16', marginBottom: 8, padding: 9 },
  replacementFloorGroup: { marginBottom: 6 },
  replacementFloorBar: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 54, paddingHorizontal: 10, paddingVertical: 8 },
  replacementFloorSelected: { borderColor: '#386E9F', borderWidth: 2 },
  replacementFloorDisabled: { backgroundColor: '#F0F2F5', opacity: 0.7 },
  replacementFloorSummary: { flex: 1 },
  replacementFloorTitle: { color: '#172033', fontSize: 13, fontWeight: '800' },
  replacementFloorMeta: { color: '#657084', fontSize: 11, marginTop: 2 },
  replacementFloorArrow: { color: '#315A86', fontSize: 20, fontWeight: '800', marginLeft: 8 },
  mutedText: { color: '#929AA7' },
  replacementRoomList: { backgroundColor: '#FFF', borderColor: '#D8E0EA', borderRadius: 8, borderTopWidth: 0, borderWidth: 1, padding: 7 },
  replacementRoom: { borderColor: '#B8C5D4', borderRadius: 7, borderWidth: 1, marginBottom: 6, padding: 9 },
  replacementRoomOn: { backgroundColor: '#386E9F', borderColor: '#386E9F' },
  replacementRoomHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  replacementRoomName: { color: '#172033', fontWeight: '800' },
  replacementRoomCapacity: { color: '#315A86', fontSize: 12, fontWeight: '700' },
  replacementRoomDetail: { color: '#657084', fontSize: 11, marginTop: 4 },
  comparison: { backgroundColor: '#FFF', borderColor: '#D8E0EA', borderRadius: 8, borderWidth: 1, marginBottom: 9, padding: 9 },
  comparisonTitle: { color: '#172033', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  comparisonRow: { alignItems: 'flex-start', borderTopColor: '#EDF0F4', borderTopWidth: 1, flexDirection: 'row', paddingVertical: 6 },
  comparisonLabel: { color: '#657084', fontSize: 10, fontWeight: '700', width: 58 },
  comparisonValue: { color: '#344057', flex: 1, fontSize: 10 },
  comparisonArrow: { color: '#315A86', fontSize: 12, marginHorizontal: 5 },
});
