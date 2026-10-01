import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared';
import type { Room } from '../../room_management';
import { getRooms } from '../../room_management';
import type { ManagedSmartLock } from '../model/managedSmartLock';
import {
  connectOneIoT,
  disconnectOneIoT,
  getOneIoTConnectionStatus,
} from '../services/oneIoTClient';
import {
  assignSmartLockToRoom,
  getManagedSmartLock,
  unassignSmartLock,
} from '../services/smartLockRepository';

type SmartLockManagementScreenProps = {
  adminUsername: string;
  onBack: () => void;
};

export function SmartLockManagementScreen({
  adminUsername,
  onBack,
}: SmartLockManagementScreenProps) {
  const [lock, setLock] = useState<ManagedSmartLock | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeFloor, setActiveFloor] = useState(1);
  const [token, setToken] = useState('');
  const [oneIotState, setOneIotState] = useState<'UNKNOWN' | 'CONNECTED' | 'DISCONNECTED'>('UNKNOWN');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [managedLock, roomItems] = await Promise.all([
      getManagedSmartLock(),
      getRooms(),
    ]);
    setLock(managedLock);
    setRooms(roomItems);
    const assignedRoom = roomItems.find(item => item.id === managedLock.assignedRoomId);
    if (assignedRoom) setActiveFloor(assignedRoom.floor);
    const status = await getOneIoTConnectionStatus();
    setOneIotState(status.connected ? 'CONNECTED' : 'DISCONNECTED');
  }, []);

  useEffect(() => {
    load().catch(error => {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể tải thông tin khóa.');
    });
  }, [load]);

  const assignedRoom = rooms.find(item => item.id === lock?.assignedRoomId);
  const floorRooms = useMemo(
    () => rooms.filter(item => item.floor === activeFloor && item.lockType === 'PIN_CODE'),
    [activeFloor, rooms],
  );

  const runAction = async (action: () => Promise<ManagedSmartLock>, success: string) => {
    setWorking(true);
    try {
      const updated = await action();
      setLock(updated);
      setIsError(false);
      setMessage(success);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật khóa.');
    } finally {
      setWorking(false);
    }
  };

  const checkOneIoT = async () => {
    if (!lock) return;
    setWorking(true);
    try {
      const status = await connectOneIoT(lock, token);
      setOneIotState(status.connected ? 'CONNECTED' : 'DISCONNECTED');
      setIsError(!status.connected);
      setMessage(
        status.connected
          ? 'Tools trong app đã kết nối OneIoT và sẵn sàng gửi lệnh.'
          : 'OneIoT chưa xác nhận kết nối.',
      );
    } catch (error) {
      setOneIotState('DISCONNECTED');
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không kiểm tra được kết nối OneIoT.');
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    setWorking(true);
    try {
      await disconnectOneIoT();
      setOneIotState('DISCONNECTED');
      setIsError(false);
      setMessage('Đã ngắt kết nối OneIoT của phiên hiện tại.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể ngắt kết nối OneIoT.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={styles.page}>
      <ScreenHeader title="Quản lý khóa" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {message ? (
          <Text style={[styles.message, isError && styles.errorMessage]}>{message}</Text>
        ) : null}

        <View style={styles.card}>
          <View style={styles.lockHeader}>
            <View style={styles.lockIcon}><Text style={styles.lockIconText}>⌨</Text></View>
            <View style={styles.lockTitleBox}>
              <Text style={styles.lockTitle}>{lock?.displayName ?? 'SmartLock'}</Text>
              <Text style={styles.lockSubtitle}>Thiết bị đích; Tools trong app gửi lệnh qua OneIoT</Text>
            </View>
          </View>
          <InfoRow label="Model" value={lock?.model ?? '—'} />
          <InfoRow label="SmartLock Device ID" value={lock?.smartLockDeviceId ?? '—'} />
          <InfoRow label="SmartLock Device name" value={lock?.smartLockDeviceName ?? '—'} />
          <InfoRow label="Tools Device ID" value={lock?.toolDeviceId ?? '—'} />
          <InfoRow
            label="Phòng đang gắn"
            value={assignedRoom ? `${assignedRoom.name} · Tầng ${assignedRoom.floor}` : 'Chưa gắn phòng'}
            emphasis
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kết nối Tools với OneIoT</Text>
          <Text style={styles.helpText}>
            Dán token tương ứng với Tools Device ID ở trên. Token chỉ được giữ trong bộ nhớ của phiên app, không lưu vào dữ liệu local hay source code. Sau khi kết nối, app đồng thời nghe bản tin mở/khóa từ SmartLock để ghi nhận check in và check out.
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setToken}
            placeholder="Dán token OneIoT của Tools"
            placeholderTextColor="#8A94A4"
            secureTextEntry
            selectTextOnFocus
            style={styles.input}
            value={token}
          />
          <Text style={styles.endpointText}>
            MQTT TLS: {lock?.oneIotBroker ?? '—'}:{lock?.oneIotPort ?? '—'}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                oneIotState === 'CONNECTED'
                  ? styles.connectedDot
                  : oneIotState === 'DISCONNECTED'
                    ? styles.disconnectedDot
                    : styles.unknownDot,
              ]}
            />
            <Text style={styles.statusText}>
              {oneIotState === 'CONNECTED'
                ? 'Đã kết nối'
                : oneIotState === 'DISCONNECTED'
                  ? 'Chưa kết nối'
                  : 'Chưa kiểm tra'}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              disabled={working}
              onPress={checkOneIoT}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{working ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</Text>
            </Pressable>
            {oneIotState === 'CONNECTED' ? (
              <Pressable
                disabled={working}
                onPress={disconnect}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Ngắt kết nối</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.sessionNote}>App sẽ tự ngắt OneIoT khi đăng xuất, chuyển sang nền hoặc bị đóng.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gắn khóa vào phòng khóa số</Text>
          <Text style={styles.helpText}>
            Khi chuyển sang phòng mới, liên kết phòng cũ tự động bị thay thế.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.floorScroll}>
            {Array.from({ length: 8 }, (_, index) => index + 1).map(floor => (
              <Pressable
                key={floor}
                onPress={() => setActiveFloor(floor)}
                style={[styles.floorButton, activeFloor === floor && styles.floorButtonActive]}
              >
                <Text style={[styles.floorText, activeFloor === floor && styles.floorTextActive]}>
                  Tầng {floor}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {floorRooms.length ? floorRooms.map(room => {
            const selected = lock?.assignedRoomId === room.id;
            return (
              <Pressable
                key={room.id}
                disabled={working || selected}
                onPress={() => runAction(
                  () => assignSmartLockToRoom(room.id, adminUsername),
                  `Đã gắn SmartLock vào phòng ${room.name}.`,
                )}
                style={[styles.roomRow, selected && styles.roomRowSelected]}
              >
                <View style={styles.roomTextBox}>
                  <Text style={[styles.roomName, selected && styles.roomNameSelected]}>{room.name}</Text>
                  <Text style={styles.roomDetail}>
                    {room.capacity} chỗ · {room.equipment.join(', ') || 'Không có thiết bị'}
                  </Text>
                </View>
                <Text style={[styles.assignText, selected && styles.assignedText]}>
                  {selected ? 'Đang gắn' : 'Gắn khóa'}
                </Text>
              </Pressable>
            );
          }) : <Text style={styles.emptyText}>Tầng này chưa có phòng sử dụng khóa mã số.</Text>}

          {assignedRoom ? (
            <Pressable
              disabled={working}
              onPress={() => runAction(
                () => unassignSmartLock(adminUsername),
                `Đã tháo SmartLock khỏi phòng ${assignedRoom.name}.`,
              )}
              style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
            >
              <Text style={styles.dangerButtonText}>Tháo khóa khỏi {assignedRoom.name}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={[styles.infoValue, emphasis && styles.infoValueEmphasis]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7FB', flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  message: { backgroundColor: '#EAF5EE', borderRadius: 9, color: '#17613A', marginBottom: 12, padding: 11 },
  errorMessage: { backgroundColor: '#FFF0F1', color: '#A62335' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E1E6EE', borderRadius: 13, borderWidth: 1, marginBottom: 14, padding: 16 },
  lockHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: 13 },
  lockIcon: { alignItems: 'center', backgroundColor: '#F2E8EC', borderRadius: 12, height: 48, justifyContent: 'center', width: 48 },
  lockIconText: { color: '#B01432', fontSize: 25, fontWeight: '900' },
  lockTitleBox: { flex: 1, marginLeft: 12 },
  lockTitle: { color: '#172033', fontSize: 18, fontWeight: '900' },
  lockSubtitle: { color: '#657084', fontSize: 12, marginTop: 3 },
  infoRow: { borderTopColor: '#EEF1F5', borderTopWidth: 1, paddingVertical: 10 },
  infoLabel: { color: '#718096', fontSize: 12, marginBottom: 3 },
  infoValue: { color: '#29354A', fontSize: 13, fontWeight: '700' },
  infoValueEmphasis: { color: '#B01432', fontSize: 15 },
  sectionTitle: { color: '#253047', fontSize: 16, fontWeight: '900', marginBottom: 6 },
  helpText: { color: '#657084', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  input: { backgroundColor: '#F9FAFC', borderColor: '#C9D2E0', borderRadius: 9, borderWidth: 1, color: '#172033', paddingHorizontal: 12, paddingVertical: 11 },
  endpointText: { color: '#718096', fontSize: 12, marginTop: 8 },
  sessionNote: { color: '#718096', fontSize: 12, lineHeight: 17, marginTop: 10 },
  statusRow: { alignItems: 'center', flexDirection: 'row', marginTop: 11 },
  statusDot: { borderRadius: 5, height: 10, marginRight: 7, width: 10 },
  connectedDot: { backgroundColor: '#259A58' },
  disconnectedDot: { backgroundColor: '#C7364F' },
  unknownDot: { backgroundColor: '#A6AFBC' },
  statusText: { color: '#4A566B', fontSize: 13, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, flex: 1, padding: 11 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: '#B01432', borderRadius: 9, borderWidth: 1, flex: 1, padding: 11 },
  secondaryButtonText: { color: '#B01432', fontWeight: '800' },
  floorScroll: { marginBottom: 11 },
  floorButton: { backgroundColor: '#EEF2F7', borderRadius: 999, marginRight: 7, paddingHorizontal: 13, paddingVertical: 8 },
  floorButtonActive: { backgroundColor: '#B01432' },
  floorText: { color: '#4A566B', fontSize: 13, fontWeight: '800' },
  floorTextActive: { color: '#FFFFFF' },
  roomRow: { alignItems: 'center', borderColor: '#E1E6EE', borderRadius: 10, borderWidth: 1, flexDirection: 'row', marginBottom: 8, padding: 12 },
  roomRowSelected: { backgroundColor: '#FFF2F4', borderColor: '#B01432' },
  roomTextBox: { flex: 1, paddingRight: 8 },
  roomName: { color: '#253047', fontSize: 15, fontWeight: '900' },
  roomNameSelected: { color: '#B01432' },
  roomDetail: { color: '#657084', fontSize: 12, marginTop: 3 },
  assignText: { color: '#426B96', fontSize: 12, fontWeight: '800' },
  assignedText: { color: '#B01432' },
  emptyText: { color: '#7A8493', paddingVertical: 18, textAlign: 'center' },
  dangerButton: { alignItems: 'center', borderColor: '#C7364F', borderRadius: 9, borderWidth: 1, marginTop: 9, padding: 11 },
  dangerButtonText: { color: '#B1263D', fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
