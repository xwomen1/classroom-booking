import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { DEFAULT_CONFIGURATION, type AppConfiguration } from '../model/appConfiguration';
import { getConfiguration, saveConfiguration } from '../services/configurationRepository';

type Props = { adminUsername: string; onBack: () => void };
export function ConfigurationScreen({ adminUsername, onBack }: Props) {
  const [config, setConfig] = useState<AppConfiguration>(DEFAULT_CONFIGURATION); const [message, setMessage] = useState('');
  useEffect(() => { getConfiguration().then(setConfig); }, []);
  const numeric = (field: keyof Omit<AppConfiguration, 'notificationsEnabled'>, value: string) => setConfig(current => ({ ...current, [field]: Number(value.replace(/\D/g, '')) }));
  const save = async () => { try { await saveConfiguration(config, adminUsername); setMessage('Đã lưu quy định đặt phòng.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể lưu quy định.'); } };
  return <View style={styles.page}><ScreenHeader title="Quy định đặt phòng" onBack={onBack} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <NumberField label="Đặt trước tối thiểu (ngày)" value={config.minAdvanceDays} onChange={value => numeric('minAdvanceDays', value)} />
    <NumberField label="Đặt trước tối đa (ngày)" value={config.maxAdvanceDays} onChange={value => numeric('maxAdvanceDays', value)} />
    <NumberField label="Yêu cầu đang hoạt động tối đa mỗi người" value={config.maxActiveBookingsPerUser} onChange={value => numeric('maxActiveBookingsPerUser', value)} />
    <NumberField label="Hạn hủy yêu cầu đã duyệt (phút trước giờ bắt đầu)" value={config.cancellationCutoffMinutes} onChange={value => numeric('cancellationCutoffMinutes', value)} />
    <NumberField label="Hạn đổi phòng (phút trước giờ bắt đầu)" value={config.roomChangeCutoffMinutes} onChange={value => numeric('roomChangeCutoffMinutes', value)} />
    <NumberField label="Khoảng đệm hiệu lực mã số (phút)" value={config.pinGraceMinutes} onChange={value => numeric('pinGraceMinutes', value)} />
    <View style={styles.switchRow}><View style={styles.switchText}><Text style={styles.label}>Thông báo hoạt động</Text><Text style={styles.note}>Tắt mục này sẽ ngừng tạo thông báo mới.</Text></View><Switch value={config.notificationsEnabled} onValueChange={value => setConfig(current => ({ ...current, notificationsEnabled: value }))} /></View>
    {message ? <Text style={styles.message}>{message}</Text> : null}<Pressable style={styles.primary} onPress={save}><Text style={styles.primaryText}>Lưu quy định</Text></Pressable>
  </ScrollView></View>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput keyboardType="number-pad" onChangeText={onChange} style={styles.input} value={String(value)} /></View>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 20, paddingBottom: 40 }, field: { marginBottom: 14 }, label: { color: '#344057', fontSize: 14, fontWeight: '700', marginBottom: 6 }, input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 9, borderWidth: 1, color: '#172033', paddingHorizontal: 12, paddingVertical: 10 }, switchRow: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, flexDirection: 'row', marginBottom: 15, padding: 13 }, switchText: { flex: 1 }, note: { color: '#6A7485', fontSize: 12 }, message: { backgroundColor: '#EDF5FF', borderRadius: 8, color: '#24598F', marginBottom: 13, padding: 10 }, primary: { alignItems: 'center', backgroundColor: '#B01432', borderRadius: 9, paddingVertical: 13 }, primaryText: { color: '#FFF', fontWeight: '800' } });
