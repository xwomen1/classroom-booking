import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import {
  getRoomPinPermissions,
  revokeRoomPinPermission,
  type RoomPinPermission,
} from '../../access_control';
import {
  createManagedAccount,
  deleteManagedAccount,
  getAccounts,
  updateManagedAccount,
} from '../../auth';
import type { AccountRecord } from '../../auth/model/demoAccounts';
import { getRooms, type Room } from '../../room_management';

type Props = { adminUsername: string; onBack: () => void };

export function AccountManagementScreen({ adminUsername, onBack }: Props) {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [permissions, setPermissions] = useState<RoomPinPermission[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [query, setQuery] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [accountItems, permissionItems, roomItems] = await Promise.all([
      getAccounts(),
      getRoomPinPermissions(),
      getRooms(),
    ]);
    setAccounts(accountItems);
    setPermissions(permissionItems);
    setRooms(roomItems);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await createManagedAccount({ username, password, recoveryCode, role: 'user' }, adminUsername);
      setUsername(''); setPassword(''); setRecoveryCode('');
      setMessage('Đã thêm tài khoản giảng viên.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể thêm tài khoản.');
    }
  };

  const update = async (target: string, changes: Parameters<typeof updateManagedAccount>[1]) => {
    try {
      await updateManagedAccount(target, changes, adminUsername);
      setMessage('Đã cập nhật tài khoản.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật.');
    }
  };

  const remove = async (target: string) => {
    try {
      await deleteManagedAccount(target, adminUsername);
      setMessage('Đã xóa tài khoản.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể xóa.');
    }
  };

  const revoke = async (target: string, roomId: string) => {
    try {
      await revokeRoomPinPermission(target, roomId, adminUsername);
      setMessage('Đã thu hồi quyền tự tạo mật khẩu của đúng phòng đã chọn.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể thu hồi quyền.');
    }
  };

  const visible = accounts.filter(
    item => item.role === 'user' && item.username.includes(query.trim().toLowerCase()),
  );
  return (
    <View style={styles.page}>
      <ScreenHeader title="Quản lý tài khoản và quyền phòng" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Thêm tài khoản giảng viên</Text>
        <Input label="Tên đăng nhập" value={username} onChangeText={setUsername} />
        <Input label="Mật khẩu ban đầu" value={password} onChangeText={setPassword} secureTextEntry />
        <Input label="Mã khôi phục" value={recoveryCode} onChangeText={setRecoveryCode} secureTextEntry />
        <Pressable style={styles.primary} onPress={create}><Text style={styles.primaryText}>Thêm tài khoản</Text></Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.heading}>Tài khoản và quyền tự tạo mã theo phòng</Text>
        <Text style={styles.note}>Quyền tạo mã được cấp theo từng phòng sau khi yêu cầu được duyệt và có thể thu hồi tại đây.</Text>
        <Input label="Tìm theo tên đăng nhập" value={query} onChangeText={setQuery} />
        {visible.map(account => {
          const activePermissions = permissions.filter(
            item => item.username === account.username && item.active,
          );
          return (
            <View style={styles.card} key={account.username}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>@{account.username}</Text>
                <Text style={[styles.badge, account.active === false && styles.badgeOff]}>
                  {account.active === false ? 'ĐÃ KHÓA' : 'USER'}
                </Text>
              </View>
              <Text style={styles.permissionTitle}>Phòng được tự tạo mật khẩu tạm thời</Text>
              {activePermissions.length === 0 ? (
                <Text style={styles.emptyPermission}>Chưa có quyền ở phòng nào.</Text>
              ) : activePermissions.map(permission => {
                const room = rooms.find(item => item.id === permission.roomId);
                return (
                  <View key={permission.id} style={styles.permissionRow}>
                    <View style={styles.permissionInfo}>
                      <Text style={styles.roomName}>{room?.name ?? permission.roomId}</Text>
                      <Text style={styles.roomDetail}>Tầng {room?.floor ?? '?'} · cấp khi duyệt yêu cầu</Text>
                    </View>
                    <Pressable style={styles.revokeButton} onPress={() => revoke(account.username, permission.roomId)}>
                      <Text style={styles.revokeText}>Thu hồi</Text>
                    </Pressable>
                  </View>
                );
              })}
              <View style={styles.actions}>
                <SmallButton label={account.active === false ? 'Mở khóa' : 'Khóa'} onPress={() => update(account.username, { active: account.active === false })} />
                <SmallButton label="Đặt MK: 1234" onPress={() => update(account.username, { password: '1234' })} />
                <SmallButton danger label="Xóa" onPress={() => remove(account.username)} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...rest} autoCapitalize="none" placeholderTextColor="#7D8795" style={styles.input} /></View>;
}
function SmallButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.smallButton, danger && styles.dangerButton]}><Text style={[styles.smallText, danger && styles.dangerText]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 18, paddingBottom: 40 },
  heading: { color: '#172033', fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 6 },
  note: { backgroundColor: '#FFF7E7', borderRadius: 9, color: '#765014', fontSize: 12, lineHeight: 18, marginBottom: 12, padding: 10 },
  field: { marginBottom: 11 }, label: { color: '#344057', fontSize: 13, fontWeight: '700', marginBottom: 5 },
  input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, color: '#172033', paddingHorizontal: 12, paddingVertical: 10 },
  primary: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, paddingVertical: 12 }, primaryText: { color: '#FFF', fontWeight: '800' },
  message: { backgroundColor: '#EDF5FF', borderRadius: 8, color: '#24598F', marginVertical: 12, padding: 10 },
  card: { backgroundColor: '#FFF', borderColor: '#E0E6EF', borderRadius: 11, borderWidth: 1, marginBottom: 11, padding: 13 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row' }, cardTitle: { color: '#172033', flex: 1, fontSize: 16, fontWeight: '800' },
  badge: { backgroundColor: '#DDF4E7', borderRadius: 20, color: '#24623C', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4 }, badgeOff: { backgroundColor: '#ECEEF2', color: '#6C7480' },
  permissionTitle: { color: '#4C5870', fontSize: 12, fontWeight: '800', marginTop: 12 }, emptyPermission: { color: '#7A8495', fontSize: 12, marginTop: 7 },
  permissionRow: { alignItems: 'center', backgroundColor: '#F4F0FF', borderRadius: 8, flexDirection: 'row', marginTop: 7, padding: 9 }, permissionInfo: { flex: 1 },
  roomName: { color: '#3B235F', fontWeight: '800' }, roomDetail: { color: '#6C5A84', fontSize: 11, marginTop: 2 },
  revokeButton: { borderColor: '#8D2635', borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 }, revokeText: { color: '#8D2635', fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }, smallButton: { borderColor: '#8AA1BE', borderRadius: 7, borderWidth: 1, marginBottom: 7, marginRight: 7, paddingHorizontal: 9, paddingVertical: 7 },
  smallText: { color: '#315A86', fontSize: 12, fontWeight: '700' }, dangerButton: { borderColor: '#C43A4F' }, dangerText: { color: '#B01432' },
});
