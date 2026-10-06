import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared';
import { BookingInfo } from '../../booking/components/BookingInfo';
import { getBookings } from '../../booking/services/bookingRepository';
import type {
  MaintenanceRecord,
  MaintenanceRequest,
} from '../../schedule_maintenance/model/maintenance';
import {
  cancelMaintenance,
  createMaintenance,
  getMaintenanceRecords,
  getMaintenanceRequests,
  rejectMaintenanceRequest,
  scheduleMaintenanceFromRequest,
} from '../../schedule_maintenance/services/maintenanceRepository';
import type { LockType, Room } from '../model/room';
import {
  equipmentChoices,
  isEquipmentSelected,
  toggleEquipment,
} from '../model/roomFilters';
import {
  createRoom,
  deleteRoom,
  getRooms,
  updateRoom,
} from '../services/roomRepository';

type Props = { adminUsername: string; onBack: () => void };
type Editor = 'add' | 'edit' | 'maintenance' | null;

function parseEquipment(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

const FLOORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const EMPTY_ROOM = {
  name: '',
  floor: '1',
  location: '',
  capacity: '30',
  equipment: '',
  lockType: 'PIN_CODE' as LockType,
  status: 'AVAILABLE' as Room['status'],
};

function tomorrow() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function RoomManagementScreen({ adminUsername, onBack }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof getBookings>>>([]);
  const [expandedFloors, setExpandedFloors] = useState<number[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<Editor>(null);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState(tomorrow());
  const [maintenanceStart, setMaintenanceStart] = useState('12:00');
  const [maintenanceEnd, setMaintenanceEnd] = useState('13:00');
  const [maintenanceReason, setMaintenanceReason] = useState('');

  const load = useCallback(async () => {
    const [roomItems, maintenanceItems, bookingItems, requestItems] =
      await Promise.all([
        getRooms(),
        getMaintenanceRecords(),
        getBookings(),
        getMaintenanceRequests(),
      ]);
    setRooms(roomItems);
    setSelectedRoomId(current =>
      roomItems.some(room => room.id === current) ? current : '',
    );
    setMaintenance(maintenanceItems);
    setRequests(requestItems);
    setBookings(
      bookingItems
        .filter(item => item.status === 'APPROVED')
        .sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
        ),
    );
    const requestedFloors = Array.from(
      new Set(
        requestItems
          .filter(item => item.status === 'PENDING')
          .map(item => roomItems.find(room => room.id === item.roomId)?.floor)
          .filter((floor): floor is number => typeof floor === 'number'),
      ),
    );
    setExpandedFloors(current =>
      Array.from(new Set([...current, ...requestedFloors])),
    );
  }, []);

  useEffect(() => {
    load().catch(error =>
      setMessage(error instanceof Error ? error.message : 'Không thể tải dữ liệu.'),
    );
  }, [load]);

  const selectedRoom = rooms.find(room => room.id === selectedRoomId);
  const pendingRequests = requests.filter(item => item.status === 'PENDING');
  const pendingRequestRoomIds = useMemo(
    () => new Set(pendingRequests.map(item => item.roomId)),
    [pendingRequests],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRooms = rooms.filter(room =>
    `${room.name} ${room.location} ${room.equipment.join(' ')}`
      .toLowerCase()
      .includes(normalizedQuery),
  );
  const selectedMaintenance = maintenance.filter(
    item => !item.cancelledAt && item.roomId === selectedRoomId,
  );
  const selectedBookings = bookings.filter(item => item.roomId === selectedRoomId);

  const toggleFloor = (floor: number) => {
    setExpandedFloors(current =>
      current.includes(floor)
        ? current.filter(item => item !== floor)
        : [...current, floor],
    );
  };

  const selectRoom = (room: Room, keepRequest = false) => {
    setSelectedRoomId(room.id);
    setExpandedFloors(current => Array.from(new Set([...current, room.floor])));
    setEditor(null);
    if (!keepRequest) {
      setActiveRequestId(null);
      setMaintenanceReason('');
    }
  };

  const setRoomField = (field: keyof typeof EMPTY_ROOM, value: string) => {
    setRoomForm(current => ({ ...current, [field]: value }));
  };

  const openAddRoom = () => {
    setRoomForm({
      ...EMPTY_ROOM,
      floor: selectedRoom ? String(selectedRoom.floor) : '1',
    });
    setEditor('add');
    setActiveRequestId(null);
  };

  const openEditRoom = () => {
    if (!selectedRoom) return;
    setRoomForm({
      name: selectedRoom.name,
      floor: String(selectedRoom.floor),
      location: selectedRoom.location,
      capacity: String(selectedRoom.capacity),
      equipment: selectedRoom.equipment.join(', '),
      lockType: selectedRoom.lockType,
      status: selectedRoom.status,
    });
    setEditor('edit');
    setActiveRequestId(null);
  };

  const saveRoom = async () => {
    try {
      const input = {
        ...roomForm,
        floor: Number(roomForm.floor),
        capacity: Number(roomForm.capacity),
        equipment: roomForm.equipment
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
      };
      const saved =
        editor === 'edit' && selectedRoom
          ? await updateRoom(selectedRoom.id, input, adminUsername)
          : await createRoom(input, adminUsername);
      setSelectedRoomId(saved.id);
      setExpandedFloors(current => Array.from(new Set([...current, saved.floor])));
      setEditor(null);
      setMessage(editor === 'edit' ? 'Đã cập nhật phòng.' : 'Đã thêm phòng.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể lưu phòng.');
    }
  };

  const removeSelectedRoom = () => {
    if (!selectedRoom) return;
    Alert.alert('Xóa phòng', `Bạn có chắc muốn xóa ${selectedRoom.name}?`, [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoom(selectedRoom.id, adminUsername);
            setSelectedRoomId('');
            setEditor(null);
            setMessage('Đã xóa phòng.');
            await load();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : 'Không thể xóa phòng.',
            );
          }
        },
      },
    ]);
  };

  const openMaintenance = (request?: MaintenanceRequest) => {
    const room = request
      ? rooms.find(item => item.id === request.roomId)
      : selectedRoom;
    if (!room) return;
    selectRoom(room, Boolean(request));
    setActiveRequestId(request?.id ?? null);
    setMaintenanceReason(request?.reason ?? '');
    setEditor('maintenance');
    if (request) {
      setMessage(
        `Đang xử lý yêu cầu của ${request.requesterUsername} cho ${room.name}.`,
      );
    }
  };

  const addMaintenance = async () => {
    if (!selectedRoom) {
      setMessage('Vui lòng chọn phòng cần bảo trì.');
      return;
    }
    try {
      const input = {
        roomId: selectedRoom.id,
        date: maintenanceDate,
        startTime: maintenanceStart,
        endTime: maintenanceEnd,
        reason: maintenanceReason,
        createdBy: adminUsername,
      };
      if (activeRequestId) {
        await scheduleMaintenanceFromRequest(activeRequestId, input);
      } else {
        await createMaintenance(input);
      }
      setMaintenanceReason('');
      setActiveRequestId(null);
      setEditor(null);
      setMessage(
        activeRequestId
          ? 'Đã tiếp nhận yêu cầu và tạo lịch bảo trì.'
          : 'Đã tạo lịch bảo trì.',
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tạo lịch bảo trì.',
      );
    }
  };

  const rejectRequest = async (request: MaintenanceRequest) => {
    try {
      await rejectMaintenanceRequest(
        request.id,
        adminUsername,
        'Chưa cần lên lịch bảo trì.',
      );
      if (activeRequestId === request.id) {
        setActiveRequestId(null);
        setEditor(null);
      }
      setMessage('Đã từ chối yêu cầu và thông báo cho người dùng.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Không thể từ chối yêu cầu.',
      );
    }
  };

  const cancelRecord = async (id: string) => {
    try {
      await cancelMaintenance(id, adminUsername);
      setMessage('Đã hủy lịch bảo trì.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể hủy lịch.');
    }
  };

  return (
    <View style={styles.page}>
      <ScreenHeader title="Quản lý phòng và bảo trì" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.heading}>Phòng theo tầng</Text>
            <Text style={styles.helper}>
              Chọn một phòng để sửa, xóa hoặc quản lý lịch bảo trì.
            </Text>
          </View>
          <Pressable style={styles.addButton} onPress={openAddRoom}>
            <Text style={styles.addButtonText}>+ Thêm phòng</Text>
          </Pressable>
        </View>

        <Input
          label="Tìm tên, vị trí hoặc thiết bị"
          value={query}
          onChangeText={setQuery}
        />

        {pendingRequests.length ? (
          <View style={styles.requestSection}>
            <Text style={styles.requestSectionTitle}>
              {pendingRequests.length} yêu cầu bảo trì đang chờ
            </Text>
            {pendingRequests.map(request => {
              const room = rooms.find(item => item.id === request.roomId);
              return (
                <View key={request.id} style={styles.requestCard}>
                  <Text style={styles.cardTitle}>{room?.name ?? request.roomId}</Text>
                  <Text style={styles.detail}>
                    {request.requesterUsername} ·{' '}
                    {new Date(request.requestedAt).toLocaleString('vi-VN')}
                  </Text>
                  <Text style={styles.requestReason}>{request.reason}</Text>
                  <View style={styles.actionRow}>
                    <ActionButton
                      label="Lên lịch xử lý"
                      onPress={() => openMaintenance(request)}
                      primary
                    />
                    <ActionButton
                      label="Từ chối"
                      onPress={() => rejectRequest(request)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.floorList}>
          {FLOORS.map(floor => {
            const floorRooms = visibleRooms
              .filter(room => room.floor === floor)
              .sort((a, b) => a.name.localeCompare(b.name));
            const allFloorRooms = rooms.filter(room => room.floor === floor);
            const floorIds = new Set(allFloorRooms.map(room => room.id));
            const maintenanceCount = new Set(
              maintenance
                .filter(item => !item.cancelledAt && floorIds.has(item.roomId))
                .map(item => item.roomId),
            ).size;
            const requestCount = allFloorRooms.filter(room =>
              pendingRequestRoomIds.has(room.id),
            ).length;
            const expanded = expandedFloors.includes(floor);
            const selectedOnFloor = selectedRoom?.floor === floor;
            return (
              <View key={floor} style={styles.floorGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => toggleFloor(floor)}
                  style={[
                    styles.floorBar,
                    selectedOnFloor && styles.floorBarSelected,
                    requestCount > 0 && styles.floorBarRequested,
                  ]}
                >
                  <View style={styles.floorSummary}>
                    <Text style={styles.floorTitle}>Tầng {floor}</Text>
                    <Text style={styles.floorMeta}>
                      {normalizedQuery
                        ? `${floorRooms.length}/${allFloorRooms.length} phòng phù hợp`
                        : `${allFloorRooms.length} phòng`}
                      {maintenanceCount
                        ? ` · ${maintenanceCount} phòng có lịch bảo trì`
                        : ''}
                      {requestCount ? ` · ${requestCount} phòng được báo sự cố` : ''}
                    </Text>
                  </View>
                  <Text style={styles.floorArrow}>{expanded ? '⌃' : '⌄'}</Text>
                </Pressable>
                {expanded ? (
                  <View style={styles.roomChoices}>
                    {floorRooms.length ? (
                      floorRooms.map(room => (
                        <RoomChoice
                          key={room.id}
                          room={room}
                          requested={pendingRequestRoomIds.has(room.id)}
                          selected={selectedRoomId === room.id}
                          onPress={() => selectRoom(room)}
                        />
                      ))
                    ) : (
                      <Text style={styles.emptyFloor}>
                        {normalizedQuery
                          ? 'Không có phòng phù hợp bộ lọc.'
                          : 'Tầng này chưa có phòng.'}
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {editor === 'add' || editor === 'edit' ? (
          <RoomEditor
            form={roomForm}
            mode={editor}
            onChange={setRoomField}
            onCancel={() => setEditor(null)}
            onSave={saveRoom}
          />
        ) : null}

        {selectedRoom ? (
          <View style={styles.selectedPanel}>
            <View style={styles.selectedHeader}>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.selectedTitle}>{selectedRoom.name}</Text>
                <Text style={styles.detail}>
                  {selectedRoom.location} · {selectedRoom.capacity} người
                </Text>
              </View>
              <Text
                style={[
                  styles.status,
                  selectedRoom.status === 'MAINTENANCE' && styles.statusOff,
                ]}
              >
                {selectedRoom.status === 'AVAILABLE' ? 'KHẢ DỤNG' : 'TẠM KHÓA'}
              </Text>
            </View>
            <Text style={styles.detail}>
              {selectedRoom.equipment.join(', ') || 'Không ghi thiết bị'}
            </Text>
            <Text style={styles.detail}>
              {selectedRoom.lockType === 'PIN_CODE'
                ? 'Khóa mã số online'
                : 'Khóa cơ / thẻ từ'}
            </Text>
            <View style={styles.actionRow}>
              <ActionButton label="Sửa phòng" onPress={openEditRoom} />
              <ActionButton
                label="Bảo trì"
                onPress={() => openMaintenance()}
                primary
              />
              <ActionButton label="Xóa phòng" onPress={removeSelectedRoom} danger />
            </View>

            {editor === 'maintenance' ? (
              <View style={styles.editorBox}>
                <Text style={styles.editorTitle}>
                  Lên lịch bảo trì · {selectedRoom.name}
                </Text>
                {activeRequestId ? (
                  <Text style={styles.activeRequestText}>
                    Lịch này đang xử lý một yêu cầu từ người dùng.
                  </Text>
                ) : null}
                <Input
                  label="Ngày (YYYY-MM-DD)"
                  value={maintenanceDate}
                  onChangeText={setMaintenanceDate}
                />
                <View style={styles.timeRow}>
                  <View style={styles.half}>
                    <Input
                      label="Bắt đầu"
                      value={maintenanceStart}
                      onChangeText={setMaintenanceStart}
                    />
                  </View>
                  <View style={styles.gap} />
                  <View style={styles.half}>
                    <Input
                      label="Kết thúc"
                      value={maintenanceEnd}
                      onChangeText={setMaintenanceEnd}
                    />
                  </View>
                </View>
                <Input
                  label="Lý do"
                  value={maintenanceReason}
                  onChangeText={setMaintenanceReason}
                />
                <Pressable style={styles.primaryButton} onPress={addMaintenance}>
                  <Text style={styles.primaryButtonText}>Lên lịch bảo trì</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditor(null);
                    setActiveRequestId(null);
                    setMaintenanceReason('');
                  }}
                >
                  <Text style={styles.cancelEdit}>Hủy</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.subheading}>Lịch bảo trì của phòng</Text>
            {selectedMaintenance.length ? (
              selectedMaintenance.map(item => (
                <View style={styles.recordCard} key={item.id}>
                  <Text style={styles.cardTitle}>
                    {item.date} · {item.startTime}–{item.endTime}
                  </Text>
                  <Text style={styles.detail}>{item.reason}</Text>
                  <Pressable onPress={() => cancelRecord(item.id)}>
                    <Text style={styles.dangerLink}>Hủy lịch bảo trì</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Phòng chưa có lịch bảo trì đang hoạt động.</Text>
            )}

            <Text style={styles.subheading}>Lịch sử dụng đã duyệt</Text>
            {selectedBookings.length ? (
              selectedBookings.map(item => (
                <View style={styles.recordCard} key={item.id}>
                  <BookingInfo booking={item} />
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Phòng chưa có lịch sử dụng được duyệt.</Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptySelection}>
            Mở một tầng và chọn phòng để xem các thao tác quản lý.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function RoomChoice({
  room,
  requested,
  selected,
  onPress,
}: {
  room: Room;
  requested: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.roomChoice,
        requested && styles.roomChoiceRequested,
        selected && styles.roomChoiceSelected,
      ]}
    >
      <Text
        style={[
          styles.roomChoiceName,
          selected && styles.roomChoiceTextSelected,
        ]}
      >
        {room.name}
      </Text>
      <Text
        style={[
          styles.roomChoiceMeta,
          selected && styles.roomChoiceTextSelected,
        ]}
      >
        {room.capacity} người ·{' '}
        {room.status === 'AVAILABLE' ? 'Khả dụng' : 'Tạm khóa'}
      </Text>
      {requested ? <Text style={styles.requestMark}>Có yêu cầu</Text> : null}
    </Pressable>
  );
}

function RoomEditor({
  form,
  mode,
  onChange,
  onCancel,
  onSave,
}: {
  form: typeof EMPTY_ROOM;
  mode: 'add' | 'edit';
  onChange: (field: keyof typeof EMPTY_ROOM, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.editorBox}>
      <Text style={styles.editorTitle}>
        {mode === 'edit' ? 'Sửa thông tin phòng' : 'Thêm phòng mới'}
      </Text>
      <Input label="Tên phòng" value={form.name} onChangeText={value => onChange('name', value)} />
      <Input label="Tầng (1–8)" value={form.floor} onChangeText={value => onChange('floor', value)} keyboardType="number-pad" />
      <Input label="Vị trí" value={form.location} onChangeText={value => onChange('location', value)} />
      <Input label="Sức chứa" value={form.capacity} onChangeText={value => onChange('capacity', value)} keyboardType="number-pad" />
      <Text style={styles.label}>Trang thiết bị</Text>
      <View style={styles.choiceRow}>
        {equipmentChoices(parseEquipment(form.equipment)).map(option => (
          <Choice
            key={option}
            label={option}
            selected={isEquipmentSelected(parseEquipment(form.equipment), option)}
            onPress={() => onChange('equipment', toggleEquipment(parseEquipment(form.equipment), option).join(', '))}
          />
        ))}
      </View>
      <Text style={styles.label}>Loại khóa</Text>
      <View style={styles.choiceRow}>
        <Choice label="Mã số online" selected={form.lockType === 'PIN_CODE'} onPress={() => onChange('lockType', 'PIN_CODE')} />
        <Choice label="Cơ / thẻ" selected={form.lockType === 'PHYSICAL_KEY'} onPress={() => onChange('lockType', 'PHYSICAL_KEY')} />
      </View>
      <Text style={styles.label}>Trạng thái</Text>
      <View style={styles.choiceRow}>
        <Choice label="Khả dụng" selected={form.status === 'AVAILABLE'} onPress={() => onChange('status', 'AVAILABLE')} />
        <Choice label="Tạm khóa" selected={form.status === 'MAINTENANCE'} onPress={() => onChange('status', 'MAINTENANCE')} />
      </View>
      <Pressable style={styles.primaryButton} onPress={onSave}>
        <Text style={styles.primaryButtonText}>
          {mode === 'edit' ? 'Lưu thay đổi' : 'Thêm phòng'}
        </Text>
      </Pressable>
      <Pressable onPress={onCancel}>
        <Text style={styles.cancelEdit}>Hủy</Text>
      </Pressable>
    </View>
  );
}

function Input(
  props: React.ComponentProps<typeof TextInput> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor="#7D8795"
        style={styles.input}
      />
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text
        style={[styles.choiceText, selected && styles.choiceTextSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  primary,
  danger,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        danger && styles.actionButtonDanger,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.actionButtonPrimaryText,
          danger && styles.actionButtonDangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  sectionHeaderText: { flex: 1 },
  heading: { color: '#172033', fontSize: 18, fontWeight: '800' },
  helper: { color: '#657084', fontSize: 12, lineHeight: 17, marginTop: 4 },
  addButton: { backgroundColor: '#B01432', borderRadius: 8, marginLeft: 10, paddingHorizontal: 12, paddingVertical: 9 },
  addButtonText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  field: { marginBottom: 10 },
  label: { color: '#344057', fontSize: 13, fontWeight: '700', marginBottom: 5 },
  input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, color: '#172033', paddingHorizontal: 12, paddingVertical: 10 },
  requestSection: { backgroundColor: '#FFFDF3', borderColor: '#E3C35B', borderRadius: 11, borderWidth: 1, marginBottom: 14, padding: 10 },
  requestSectionTitle: { color: '#755000', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  requestCard: { backgroundColor: '#FFF8D9', borderRadius: 9, marginBottom: 8, padding: 11 },
  cardTitle: { color: '#172033', fontSize: 15, fontWeight: '800' },
  detail: { color: '#596579', fontSize: 13, marginTop: 5 },
  requestReason: { color: '#4F421C', fontWeight: '600', lineHeight: 19, marginTop: 7 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  actionButton: { alignItems: 'center', borderColor: '#8190A5', borderRadius: 8, borderWidth: 1, marginBottom: 7, marginRight: 7, paddingHorizontal: 12, paddingVertical: 8 },
  actionButtonPrimary: { backgroundColor: '#B01432', borderColor: '#B01432' },
  actionButtonDanger: { borderColor: '#B01432' },
  actionButtonText: { color: '#315A86', fontSize: 12, fontWeight: '800' },
  actionButtonPrimaryText: { color: '#FFF' },
  actionButtonDangerText: { color: '#B01432' },
  floorList: { marginBottom: 8 },
  floorGroup: { marginBottom: 8 },
  floorBar: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 10, borderWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: 13, paddingVertical: 9 },
  floorBarSelected: { borderColor: '#B01432', borderWidth: 2 },
  floorBarRequested: { backgroundColor: '#FFF8D9', borderColor: '#D9A514' },
  floorSummary: { flex: 1 },
  floorTitle: { color: '#172033', fontSize: 15, fontWeight: '800' },
  floorMeta: { color: '#657084', fontSize: 11, marginTop: 4 },
  floorArrow: { color: '#B01432', fontSize: 22, fontWeight: '800', marginLeft: 10 },
  roomChoices: { backgroundColor: '#EEF2F7', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, flexDirection: 'row', flexWrap: 'wrap', padding: 8, paddingBottom: 0 },
  roomChoice: { backgroundColor: '#FFF', borderColor: '#C6D0DC', borderRadius: 8, borderWidth: 1, marginBottom: 8, marginRight: 8, minWidth: 128, padding: 9 },
  roomChoiceRequested: { backgroundColor: '#FFE89A', borderColor: '#C58B00' },
  roomChoiceSelected: { backgroundColor: '#B01432', borderColor: '#B01432' },
  roomChoiceName: { color: '#172033', fontWeight: '900' },
  roomChoiceMeta: { color: '#657084', fontSize: 10, marginTop: 3 },
  roomChoiceTextSelected: { color: '#FFF' },
  requestMark: { color: '#7A5200', fontSize: 10, fontWeight: '900', marginTop: 4 },
  emptyFloor: { color: '#6B7586', marginBottom: 8, padding: 8 },
  message: { backgroundColor: '#EDF5FF', borderRadius: 8, color: '#24598F', marginBottom: 11, padding: 10 },
  selectedPanel: { backgroundColor: '#FFF', borderColor: '#D7DEE8', borderRadius: 12, borderWidth: 1, marginTop: 6, padding: 14 },
  selectedHeader: { alignItems: 'center', flexDirection: 'row' },
  selectedTitle: { color: '#172033', fontSize: 19, fontWeight: '900' },
  status: { backgroundColor: '#DDF4E7', borderRadius: 15, color: '#24623C', fontSize: 10, fontWeight: '800', marginLeft: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusOff: { backgroundColor: '#FBE1E4', color: '#8D2635' },
  editorBox: { backgroundColor: '#F7F9FC', borderColor: '#D7DEE8', borderRadius: 10, borderWidth: 1, marginBottom: 12, marginTop: 12, padding: 12 },
  editorTitle: { color: '#172033', fontSize: 16, fontWeight: '900', marginBottom: 10 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  choice: { borderColor: '#B01432', borderRadius: 8, borderWidth: 1, marginBottom: 6, marginRight: 7, paddingHorizontal: 12, paddingVertical: 8 },
  choiceSelected: { backgroundColor: '#B01432' },
  choiceText: { color: '#B01432', fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: '#FFF' },
  primaryButton: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, paddingVertical: 12 },
  primaryButtonText: { color: '#FFF', fontWeight: '800' },
  cancelEdit: { color: '#697386', fontWeight: '700', padding: 10, textAlign: 'center' },
  activeRequestText: { backgroundColor: '#FFF8D9', borderRadius: 8, color: '#6F4E00', fontWeight: '700', marginBottom: 10, padding: 9 },
  timeRow: { flexDirection: 'row' },
  half: { flex: 1 },
  gap: { width: 10 },
  subheading: { color: '#253047', fontSize: 15, fontWeight: '900', marginBottom: 8, marginTop: 15 },
  recordCard: { backgroundColor: '#F7F9FC', borderRadius: 9, marginBottom: 8, padding: 11 },
  dangerLink: { color: '#B01432', fontSize: 13, fontWeight: '800', marginTop: 9 },
  empty: { color: '#6B7586', fontSize: 13 },
  emptySelection: { color: '#657084', marginTop: 8, textAlign: 'center' },
});
