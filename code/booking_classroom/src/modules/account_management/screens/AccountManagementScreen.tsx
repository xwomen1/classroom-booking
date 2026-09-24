import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import {
  createManagedAccount,
  deleteManagedAccount,
  getAccounts,
  updateManagedAccount,
} from '../../auth';
import type { AccountRecord } from '../../auth/model/demoAccounts';

type Props = { adminUsername: string; onBack: () => void };

export function AccountManagementScreen({ adminUsername, onBack }: Props) {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [query, setQuery] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [message, setMessage] = useState('');

  const load = useCallback(() => getAccounts().then(setAccounts), []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await createManagedAccount({ username, password, recoveryCode, role }, adminUsername);
      setUsername(''); setPassword(''); setRecoveryCode(''); setRole('user');
      setMessage('Đã thêm tài khoản.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể thêm tài khoản.'); }
  };

  const update = async (target: string, changes: Parameters<typeof updateManagedAccount>[1]) => {
    try { await updateManagedAccount(target, changes, adminUsername); setMessage('Đã cập nhật tài khoản.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể cập nhật.'); }
  };

  const remove = async (target: string) => {
    try { await deleteManagedAccount(target, adminUsername); setMessage('Đã xóa tài khoản.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể xóa.'); }
  };

  const visible = accounts.filter(item => item.username.includes(query.trim().toLowerCase()));
  return (
    <View style={styles.page}>
      <ScreenHeader title="Quản lý user" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Thêm tài khoản</Text>
        <Input label="Tên đăng nhập" value={username} onChangeText={setUsername} />
        <Input label="Mật khẩu ban đầu" value={password} onChangeText={setPassword} secureTextEntry />
        <Input label="Mã khôi phục" value={recoveryCode} onChangeText={setRecoveryCode} secureTextEntry />
        <View style={styles.row}>
          <Choice label="User" selected={role === 'user'} onPress={() => setRole('user')} />
          <Choice label="Admin" selected={role === 'admin'} onPress={() => setRole('admin')} />
        </View>
        <Pressable style={styles.primary} onPress={create}><Text style={styles.primaryText}>Thêm tài khoản</Text></Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.heading}>Danh sách và phân quyền</Text>
        <Input label="Tìm theo tên đăng nhập" value={query} onChangeText={setQuery} />
        {visible.map(account => (
          <View style={styles.card} key={account.username}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>@{account.username}</Text>
              <Text style={[styles.badge, account.active === false && styles.badgeOff]}>
                {account.role.toUpperCase()} · {account.active === false ? 'ĐÃ KHÓA' : 'HOẠT ĐỘNG'}
              </Text>
            </View>
            <View style={styles.actions}>
              <SmallButton label={account.role === 'admin' ? 'Hạ quyền User' : 'Cấp quyền Admin'} onPress={() => update(account.username, { role: account.role === 'admin' ? 'user' : 'admin' })} />
              <SmallButton label={account.active === false ? 'Mở khóa' : 'Khóa'} onPress={() => update(account.username, { active: account.active === false })} />
              <SmallButton label="Đặt MK: 1234" onPress={() => update(account.username, { password: '1234' })} />
              <SmallButton danger label="Xóa" onPress={() => remove(account.username)} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...rest} autoCapitalize="none" placeholderTextColor="#7D8795" style={styles.input} /></View>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}
function SmallButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.smallButton, danger && styles.dangerButton]}><Text style={[styles.smallText, danger && styles.dangerText]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 18, paddingBottom: 40 },
  heading: { color: '#172033', fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 6 },
  field: { marginBottom: 11 }, label: { color: '#344057', fontSize: 13, fontWeight: '700', marginBottom: 5 },
  input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, color: '#172033', paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', marginBottom: 12 }, choice: { borderColor: '#B01432', borderRadius: 8, borderWidth: 1, marginRight: 8, paddingHorizontal: 18, paddingVertical: 9 },
  choiceSelected: { backgroundColor: '#B01432' }, choiceText: { color: '#B01432', fontWeight: '700' }, choiceTextSelected: { color: '#FFF' },
  primary: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, paddingVertical: 12 }, primaryText: { color: '#FFF', fontWeight: '800' },
  message: { backgroundColor: '#EDF5FF', borderRadius: 8, color: '#24598F', marginVertical: 12, padding: 10 },
  card: { backgroundColor: '#FFF', borderColor: '#E0E6EF', borderRadius: 11, borderWidth: 1, marginBottom: 11, padding: 13 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row' }, cardTitle: { color: '#172033', flex: 1, fontSize: 16, fontWeight: '800' },
  badge: { backgroundColor: '#DDF4E7', borderRadius: 20, color: '#24623C', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4 }, badgeOff: { backgroundColor: '#ECEEF2', color: '#6C7480' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }, smallButton: { borderColor: '#8AA1BE', borderRadius: 7, borderWidth: 1, marginBottom: 7, marginRight: 7, paddingHorizontal: 9, paddingVertical: 7 },
  smallText: { color: '#315A86', fontSize: 12, fontWeight: '700' }, dangerButton: { borderColor: '#C43A4F' }, dangerText: { color: '#B01432' },
});
