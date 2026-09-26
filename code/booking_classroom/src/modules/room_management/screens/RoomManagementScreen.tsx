import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import type { LockType, Room } from '../model/room';
import { createRoom, deleteRoom, getRooms, updateRoom } from '../services/roomRepository';

type Props = { adminUsername: string; onBack: () => void };
const EMPTY = { name: '', floor: '1', location: '', capacity: '30', equipment: '', lockType: 'PIN_CODE' as LockType, status: 'AVAILABLE' as Room['status'] };
const FLOORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function RoomManagementScreen({ adminUsername, onBack }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null);
  const load = useCallback(() => getRooms().then(setRooms), []);
  useEffect(() => { load(); }, [load]);
  const set = (field: keyof typeof EMPTY, value: string) => setForm(current => ({ ...current, [field]: value }));

  const save = async () => {
    try {
      const data = { ...form, floor: Number(form.floor), capacity: Number(form.capacity), equipment: form.equipment.split(',').map(item => item.trim()).filter(Boolean) };
      if (editingId) await updateRoom(editingId, data, adminUsername);
      else await createRoom(data, adminUsername);
      setMessage(editingId ? 'Đã cập nhật phòng.' : 'Đã thêm phòng.'); setEditingId(null); setForm(EMPTY); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể lưu phòng.'); }
  };
  const edit = (room: Room) => {
    setEditingId(room.id); setForm({ name: room.name, floor: String(room.floor), location: room.location, capacity: String(room.capacity), equipment: room.equipment.join(', '), lockType: room.lockType, status: room.status });
  };
  const remove = async (id: string) => {
    try { await deleteRoom(id, adminUsername); setMessage('Đã xóa phòng.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể xóa phòng.'); }
  };
  const visible = rooms.filter(room => `${room.name} ${room.location} ${room.equipment.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <View style={styles.page}><ScreenHeader title="Quản lý phòng" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{editingId ? 'Sửa phòng' : 'Thêm phòng'}</Text>
      <Input label="Tên phòng" value={form.name} onChangeText={value => set('name', value)} />
      <Input label="Tầng (1–8)" value={form.floor} onChangeText={value => set('floor', value)} keyboardType="number-pad" />
      <Input label="Vị trí" value={form.location} onChangeText={value => set('location', value)} />
      <Input label="Sức chứa" value={form.capacity} onChangeText={value => set('capacity', value)} keyboardType="number-pad" />
      <Input label="Thiết bị (phân cách bằng dấu phẩy)" value={form.equipment} onChangeText={value => set('equipment', value)} />
      <Text style={styles.label}>Loại khóa</Text><View style={styles.row}>
        <Choice label="Mã số online" selected={form.lockType === 'PIN_CODE'} onPress={() => set('lockType', 'PIN_CODE')} />
        <Choice label="Cơ / thẻ" selected={form.lockType === 'PHYSICAL_KEY'} onPress={() => set('lockType', 'PHYSICAL_KEY')} />
      </View>
      <Text style={styles.label}>Trạng thái</Text><View style={styles.row}>
        <Choice label="Khả dụng" selected={form.status === 'AVAILABLE'} onPress={() => set('status', 'AVAILABLE')} />
        <Choice label="Tạm khóa" selected={form.status === 'MAINTENANCE'} onPress={() => set('status', 'MAINTENANCE')} />
      </View>
      <Pressable style={styles.primary} onPress={save}><Text style={styles.primaryText}>{editingId ? 'Lưu thay đổi' : 'Thêm phòng'}</Text></Pressable>
      {editingId ? <Pressable onPress={() => { setEditingId(null); setForm(EMPTY); }}><Text style={styles.cancelEdit}>Hủy sửa</Text></Pressable> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.heading}>Danh sách phòng</Text>
      <Input label="Tìm tên, vị trí hoặc thiết bị" value={query} onChangeText={setQuery} />
      <View style={styles.floorList}>
        {FLOORS.map(floor => {
          const floorRooms = visible
            .filter(room => room.floor === floor)
            .sort((a, b) => a.name.localeCompare(b.name));
          const totalRooms = rooms.filter(room => room.floor === floor).length;
          const unavailableRooms = floorRooms.filter(room => room.status === 'MAINTENANCE').length;
          const expanded = expandedFloor === floor;
          const disabled = floorRooms.length === 0;
          return <View key={floor} style={styles.floorGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, expanded }}
              disabled={disabled}
              onPress={() => setExpandedFloor(current => current === floor ? null : floor)}
              style={[styles.floorBar, disabled && styles.floorBarDisabled]}
            >
              <View style={styles.floorSummary}>
                <Text style={[styles.floorTitle, disabled && styles.mutedText]}>Tầng {floor}</Text>
                <Text style={styles.floorMeta}>
                  {query.trim()
                    ? `${floorRooms.length}/${totalRooms} phòng khớp tìm kiếm`
                    : `${floorRooms.length} phòng${unavailableRooms > 0 ? ` · ${unavailableRooms} tạm khóa` : ''}`}
                </Text>
              </View>
              <Text style={[styles.floorArrow, disabled && styles.mutedText]}>
                {disabled ? '—' : expanded ? '⌃' : '⌄'}
              </Text>
            </Pressable>
            {expanded && floorRooms.length > 0 ? <View style={styles.floorRooms}>
              {floorRooms.map(room => <RoomCard key={room.id} room={room} onEdit={edit} onRemove={remove} />)}
            </View> : null}
          </View>;
        })}
      </View>
    </ScrollView>
  </View>;
}

function RoomCard({ room, onEdit, onRemove }: {
  room: Room;
  onEdit: (room: Room) => void;
  onRemove: (id: string) => void;
}) {
  return <View style={styles.card}>
    <View style={styles.cardRow}>
      <Text style={styles.roomName}>{room.name}</Text>
      <Text style={[styles.status, room.status === 'MAINTENANCE' && styles.statusOff]}>
        {room.status === 'AVAILABLE' ? 'KHẢ DỤNG' : 'TẠM KHÓA'}
      </Text>
    </View>
    <Text style={styles.detail}>{room.location} · {room.capacity} người</Text>
    <Text style={styles.detail}>{room.equipment.join(', ') || 'Không ghi thiết bị'}</Text>
    <Text style={styles.detail}>{room.lockType === 'PIN_CODE' ? 'Khóa mã số online' : 'Khóa cơ / thẻ từ'}</Text>
    <View style={styles.row}>
      <Pressable style={styles.small} onPress={() => onEdit(room)}><Text style={styles.smallText}>Sửa</Text></Pressable>
      <Pressable style={styles.small} onPress={() => onRemove(room.id)}><Text style={styles.deleteText}>Xóa</Text></Pressable>
    </View>
  </View>;
}

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { label, ...rest } = props; return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...rest} placeholderTextColor="#7D8795" style={styles.input} /></View>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 18, paddingBottom: 40 }, heading: { color: '#172033', fontSize: 17, fontWeight: '800', marginBottom: 11, marginTop: 5 },
  field: { marginBottom: 10 }, label: { color: '#344057', fontSize: 13, fontWeight: '700', marginBottom: 5 }, input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, color: '#172033', paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }, choice: { borderColor: '#B01432', borderRadius: 8, borderWidth: 1, marginBottom: 6, marginRight: 7, paddingHorizontal: 12, paddingVertical: 8 }, choiceSelected: { backgroundColor: '#B01432' }, choiceText: { color: '#B01432', fontSize: 12, fontWeight: '700' }, choiceTextSelected: { color: '#FFF' },
  primary: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, paddingVertical: 12 }, primaryText: { color: '#FFF', fontWeight: '800' }, cancelEdit: { color: '#697386', fontWeight: '700', padding: 10, textAlign: 'center' }, message: { backgroundColor: '#EDF5FF', borderRadius: 8, color: '#24598F', marginVertical: 11, padding: 10 },
  floorList: { marginBottom: 8 }, floorGroup: { marginBottom: 8 }, floorBar: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 10, borderWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: 13, paddingVertical: 9 }, floorBarDisabled: { backgroundColor: '#F0F2F5', opacity: 0.7 }, floorSummary: { flex: 1 }, floorTitle: { color: '#172033', fontSize: 15, fontWeight: '800' }, floorMeta: { color: '#657084', fontSize: 11, marginTop: 4 }, floorArrow: { color: '#B01432', fontSize: 22, fontWeight: '800', marginLeft: 10 }, mutedText: { color: '#929AA7' }, floorRooms: { backgroundColor: '#EEF2F7', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, padding: 8, paddingBottom: 0 },
  card: { backgroundColor: '#FFF', borderColor: '#E0E6EF', borderRadius: 11, borderWidth: 1, marginBottom: 11, padding: 13 }, cardRow: { alignItems: 'center', flexDirection: 'row' }, roomName: { color: '#172033', flex: 1, fontSize: 17, fontWeight: '800' }, status: { backgroundColor: '#DDF4E7', borderRadius: 15, color: '#24623C', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4 }, statusOff: { backgroundColor: '#FBE1E4', color: '#8D2635' }, detail: { color: '#596579', fontSize: 13, marginTop: 5 }, small: { borderColor: '#9BADBF', borderRadius: 7, borderWidth: 1, marginRight: 8, marginTop: 10, paddingHorizontal: 14, paddingVertical: 7 }, smallText: { color: '#315A86', fontWeight: '700' }, deleteText: { color: '#B01432', fontWeight: '700' },
});
