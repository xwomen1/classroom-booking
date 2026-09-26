import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { BookingInfo } from '../components/BookingInfo';
import type { Booking } from '../model/booking';
import { getBookingsForUser, getBookingTimeCategory } from '../services/bookingRepository';

type Filter = 'UPCOMING' | 'USED' | 'CANCELLED';
const LABELS: Record<Filter, string> = { UPCOMING: 'Sắp tới', USED: 'Đã sử dụng', CANCELLED: 'Đã hủy / từ chối' };
export function BookingScheduleScreen({ username, onBack }: { username: string; onBack: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]); const [filter, setFilter] = useState<Filter>('UPCOMING');
  const load = useCallback(() => getBookingsForUser(username).then(setBookings), [username]);
  useEffect(() => { load(); }, [load]);
  const visible = bookings.filter(item => getBookingTimeCategory(item) === filter).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  return <View style={styles.page}><ScreenHeader title="Lịch đặt phòng" onBack={onBack} /><View style={styles.tabs}>{(Object.keys(LABELS) as Filter[]).map(key => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.tab, filter === key && styles.tabOn]}><Text style={[styles.tabText, filter === key && styles.tabTextOn]}>{LABELS[key]}</Text></Pressable>)}</View><ScrollView contentContainerStyle={styles.content}>{visible.length ? visible.map(item => <View style={styles.card} key={item.id}><BookingInfo booking={item} /></View>) : <Text style={styles.empty}>Không có lịch trong nhóm này.</Text>}</ScrollView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F4F7FB' }, tabs: { backgroundColor: '#FFF', flexDirection: 'row', padding: 8 }, tab: { alignItems: 'center', borderRadius: 8, flex: 1, paddingHorizontal: 4, paddingVertical: 9 }, tabOn: { backgroundColor: '#B01432' }, tabText: { color: '#657084', fontSize: 11, fontWeight: '700', textAlign: 'center' }, tabTextOn: { color: '#FFF' }, content: { padding: 18, paddingBottom: 40 }, card: { backgroundColor: '#FFF', borderColor: '#E1E6EE', borderRadius: 12, borderWidth: 1, marginBottom: 11, padding: 14 }, empty: { color: '#657084', marginTop: 40, textAlign: 'center' } });
