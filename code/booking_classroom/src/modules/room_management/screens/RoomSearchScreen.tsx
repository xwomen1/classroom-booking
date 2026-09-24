import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { getBookings } from '../../booking/services/bookingRepository';
import { hasMaintenanceConflict } from '../../schedule_maintenance/services/maintenanceRepository';
import type { LockType, Room } from '../model/room';
import { searchRooms } from '../services/roomRepository';

type Props = { onBack: () => void };
function tomorrow() { const date = new Date(); date.setDate(date.getDate() + 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export function RoomSearchScreen({ onBack }: Props) {
  const [keyword, setKeyword] = useState(''); const [capacity, setCapacity] = useState(''); const [equipment, setEquipment] = useState('');
  const [lockType, setLockType] = useState<LockType | 'ALL'>('ALL'); const [date, setDate] = useState(tomorrow());
  const [startTime, setStartTime] = useState('08:00'); const [endTime, setEndTime] = useState('09:00'); const [results, setResults] = useState<Room[]>([]);
  const [message, setMessage] = useState('');
  const run = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime) {
      setMessage('Ngày hoặc khoảng giờ tìm kiếm không hợp lệ.'); setResults([]); return;
    }
    const candidates = await searchRooms({ keyword, minCapacity: Number(capacity) || undefined, equipment, lockType });
    const bookings = await getBookings(); const available: Room[] = [];
    for (const room of candidates) {
      const occupied = bookings.some(item => ['PENDING', 'APPROVED'].includes(item.status) && item.roomId === room.id && item.date === date && startTime < item.endTime && endTime > item.startTime);
      if (!occupied && !(await hasMaintenanceConflict(room.id, date, startTime, endTime))) available.push(room);
    }
    setResults(available); setMessage(available.length ? `Tìm thấy ${available.length} phòng khả dụng.` : 'Không có phòng phù hợp và trống trong khung giờ này.');
  };
  return <View style={styles.page}><ScreenHeader title="Tìm kiếm phòng" onBack={onBack} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Input label="Tên hoặc vị trí" value={keyword} onChangeText={setKeyword} /><Input label="Sức chứa tối thiểu" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" /><Input label="Thiết bị cần có" value={equipment} onChangeText={setEquipment} />
    <View style={styles.row}><Choice label="Mọi loại khóa" selected={lockType === 'ALL'} onPress={() => setLockType('ALL')} /><Choice label="Mã số" selected={lockType === 'PIN_CODE'} onPress={() => setLockType('PIN_CODE')} /><Choice label="Cơ/thẻ" selected={lockType === 'PHYSICAL_KEY'} onPress={() => setLockType('PHYSICAL_KEY')} /></View>
    <Input label="Ngày" value={date} onChangeText={setDate} /><View style={styles.timeRow}><View style={styles.half}><Input label="Bắt đầu" value={startTime} onChangeText={setStartTime} /></View><View style={styles.gap} /><View style={styles.half}><Input label="Kết thúc" value={endTime} onChangeText={setEndTime} /></View></View>
    <Pressable style={styles.primary} onPress={run}><Text style={styles.primaryText}>Kiểm tra phòng trống</Text></Pressable><Text style={styles.message}>{message}</Text>
    {results.map(room => <View style={styles.card} key={room.id}><Text style={styles.room}>{room.name}</Text><Text style={styles.detail}>{room.location} · {room.capacity} người</Text><Text style={styles.detail}>{room.equipment.join(', ') || 'Không ghi thiết bị'}</Text><Text style={styles.lock}>{room.lockType === 'PIN_CODE' ? 'Khóa mã số online' : 'Khóa cơ / thẻ từ'}</Text></View>)}
  </ScrollView></View>;
}
function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { label, ...rest } = props; return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...rest} placeholderTextColor="#7D8795" style={styles.input} /></View>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}><Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 18, paddingBottom: 40 }, field: { marginBottom: 11 }, label: { color: '#344057', fontSize: 13, fontWeight: '700', marginBottom: 5 }, input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, color: '#172033', paddingHorizontal: 12, paddingVertical: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 7 }, choice: { borderColor: '#386E9F', borderRadius: 8, borderWidth: 1, marginBottom: 6, marginRight: 6, paddingHorizontal: 10, paddingVertical: 8 }, choiceOn: { backgroundColor: '#386E9F' }, choiceText: { color: '#386E9F', fontSize: 12, fontWeight: '700' }, choiceTextOn: { color: '#FFF' }, timeRow: { flexDirection: 'row' }, half: { flex: 1 }, gap: { width: 10 }, primary: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, paddingVertical: 12 }, primaryText: { color: '#FFF', fontWeight: '800' }, message: { color: '#315A86', marginVertical: 13 }, card: { backgroundColor: '#FFF', borderColor: '#E0E6EF', borderRadius: 11, borderWidth: 1, marginBottom: 10, padding: 13 }, room: { color: '#172033', fontSize: 17, fontWeight: '800' }, detail: { color: '#596579', fontSize: 13, marginTop: 5 }, lock: { color: '#5A3788', fontSize: 12, fontWeight: '700', marginTop: 7 } });
