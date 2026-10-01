import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { createTemporaryPin, getPinDisplayStatus, getRoomPinPermissions } from '../../access_control';
import { getRooms, type Room } from '../../room_management';
import {
  getMaintenanceRequests,
  requestRoomMaintenance,
  type MaintenanceRequest,
} from '../../schedule_maintenance';
import { BookingInfo } from '../components/BookingInfo';
import type { Booking } from '../model/booking';
import {
  acceptKeyPickupProposal,
  cancelBooking,
  getBookingsForUser,
  proposeKeyPickup,
  setPickupDelegate,
  toLocalDateTime,
} from '../services/bookingRepository';

const PIN_STATUS_LABEL = { PENDING: 'Chưa đến thời gian hiệu lực', ACTIVE: 'Đang có hiệu lực', EXPIRED: 'Đã hết hạn', REVOKED: 'Đã thu hồi' };
type DelegateDraft = { fullName: string; studentId: string };
type PickupDraft = { date: string; time: string };

export function MyBookingsScreen({ username, onBack }: { username: string; onBack: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [revealedPinId, setRevealedPinId] = useState<string | null>(null); const [message, setMessage] = useState(''); const [delegates, setDelegates] = useState<Record<string, DelegateDraft>>({});
  const [permittedRoomIds, setPermittedRoomIds] = useState<string[]>([]);
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, PickupDraft>>({});
  const [maintenanceReasons, setMaintenanceReasons] = useState<Record<string, string>>({});
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const load = useCallback(async () => { const [items, roomItems, permissionItems, requestItems] = await Promise.all([getBookingsForUser(username), getRooms(), getRoomPinPermissions(), getMaintenanceRequests()]); setBookings(items); setRooms(roomItems); setPermittedRoomIds(permissionItems.filter(item => item.username === username && item.active).map(item => item.roomId)); setMaintenanceRequests(requestItems.filter(item => item.requesterUsername === username)); }, [username]);
  useEffect(() => { load(); }, [load]);
  const active = bookings.filter(item => ['PENDING', 'APPROVED'].includes(item.status) && toLocalDateTime(item.date, item.endTime) > new Date());
  const action = async (operation: () => Promise<unknown>, success: string) => { try { await operation(); setMessage(success); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.'); } };
  const updateDelegate = (id: string, field: keyof DelegateDraft, value: string) => setDelegates(current => ({ ...current, [id]: { ...(current[id] ?? { fullName: '', studentId: '' }), [field]: value } }));
  const updatePickup = (id: string, field: keyof PickupDraft, value: string) => setPickupDrafts(current => ({ ...current, [id]: { ...(current[id] ?? { date: '', time: '' }), [field]: value } }));
  return <View style={styles.page}><ScreenHeader title="Đặt phòng của tôi" onBack={onBack} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {message ? <Text style={styles.message}>{message}</Text> : null}{active.length === 0 ? <Text style={styles.empty}>Không có yêu cầu đang chờ hoặc sắp sử dụng.</Text> : active.map(booking => {
      const room = rooms.find(item => item.id === booking.roomId); const pin = booking.temporaryPin?.revokedAt ? undefined : booking.temporaryPin; const reveal = revealedPinId === booking.id; const pinStatus = getPinDisplayStatus(booking); const draft = delegates[booking.id] ?? { fullName: '', studentId: '' };
      const pickupDraft = pickupDrafts[booking.id] ?? { date: booking.date, time: '' };
      const pickupNegotiation = booking.keyPickupNegotiation;
      const pendingMaintenance = maintenanceRequests.find(item => item.bookingId === booking.id && item.status === 'PENDING');
      const now = new Date();
      const currentlyInUse = booking.status === 'APPROVED' &&
        now >= toLocalDateTime(booking.date, booking.startTime) &&
        now <= toLocalDateTime(booking.date, booking.endTime);
      const canCreatePin = permittedRoomIds.includes(booking.roomId);
      return <View key={booking.id} style={styles.card}><BookingInfo booking={booking} />
        {pin ? <View style={styles.pinBox}><Text style={styles.pinLabel}>Mã mở cửa · {pinStatus ? PIN_STATUS_LABEL[pinStatus] : ''}</Text><Text style={styles.pinCode}>{reveal ? pin.code : '••••••'}</Text><Text style={styles.pinTime}>Hiệu lực: {new Date(pin.validFrom).toLocaleString('vi-VN')} – {new Date(pin.validUntil).toLocaleString('vi-VN')}</Text><Pressable onPress={() => setRevealedPinId(reveal ? null : booking.id)}><Text style={styles.link}>{reveal ? 'Ẩn mã' : 'Xem mã'}</Text></Pressable></View> : null}
        {!pin && booking.status === 'APPROVED' && room?.lockType === 'PIN_CODE' && canCreatePin ? <View style={styles.permission}><Text style={styles.permissionText}>Bạn có quyền tự tạo mã cho riêng phòng {room.name}.</Text><Pressable style={styles.purpleButton} onPress={() => action(() => createTemporaryPin(booking.id, username, 'user'), 'Đã tạo mật khẩu tạm thời.')}><Text style={styles.whiteText}>Tạo mật khẩu tạm thời</Text></Pressable></View> : null}
        {!pin && booking.status === 'APPROVED' && room?.lockType === 'PIN_CODE' && !canCreatePin ? <Text style={styles.waiting}>Quyền tự tạo mã của phòng này đã bị thu hồi. Liên hệ cán bộ quản lý để được hỗ trợ.</Text> : null}
        {booking.status === 'APPROVED' && room?.lockType === 'PHYSICAL_KEY' ? <>
          <View style={styles.delegateBox}>
            <Text style={styles.boxTitle}>Thỏa thuận thời gian nhận khóa / thẻ</Text>
            {booking.keyPickupAppointment ? <View style={styles.agreedBox}>
              <Text style={styles.agreedTitle}>Đã thống nhất</Text>
              <Text style={styles.detail}>{booking.keyPickupAppointment.date} · {booking.keyPickupAppointment.time} · {booking.keyPickupAppointment.location}</Text>
            </View> : null}
            {pickupNegotiation?.status === 'WAITING_ADMIN' ? <Text style={styles.waiting}>Đã gửi {pickupNegotiation.currentProposal.date} lúc {pickupNegotiation.currentProposal.time}. Đang chờ quản trị viên phản hồi.</Text> : null}
            {pickupNegotiation?.status === 'WAITING_USER' ? <View style={styles.counterBox}>
              <Text style={styles.boxTitle}>Quản trị viên đề xuất</Text>
              <Text style={styles.detail}>{pickupNegotiation.currentProposal.date} · {pickupNegotiation.currentProposal.time} · {pickupNegotiation.currentProposal.location}</Text>
              <Pressable style={styles.outlineButton} onPress={() => action(() => acceptKeyPickupProposal(booking.id, username, 'user'), 'Đã đồng ý thời gian nhận khóa.')}><Text style={styles.outlineText}>Đồng ý thời gian này</Text></Pressable>
            </View> : null}
            {!booking.keyPickupAppointment && pickupNegotiation?.status !== 'WAITING_ADMIN' ? <>
              <Text style={styles.helperText}>{pickupNegotiation?.status === 'WAITING_USER' ? 'Hoặc gửi lại thời gian phù hợp với bạn' : 'Bạn gửi đề xuất trước để quản trị viên duyệt hoặc đề xuất lại.'}</Text>
              <TextInput placeholder="Ngày YYYY-MM-DD" placeholderTextColor="#7D8795" style={styles.input} value={pickupDraft.date} onChangeText={value => updatePickup(booking.id, 'date', value)} />
              <TextInput placeholder="Giờ HH:mm" placeholderTextColor="#7D8795" style={styles.input} value={pickupDraft.time} onChangeText={value => updatePickup(booking.id, 'time', value)} />
              <Pressable style={styles.outlineButton} onPress={() => action(() => proposeKeyPickup(booking.id, username, 'user', pickupDraft.date, pickupDraft.time), 'Đã gửi đề xuất thời gian nhận khóa.')}><Text style={styles.outlineText}>{pickupNegotiation ? 'Gửi lại thời gian khác' : 'Gửi thời gian nhận khóa'}</Text></Pressable>
            </> : null}
          </View>
          <View style={styles.delegateBox}><Text style={styles.boxTitle}>Ủy quyền người nhận khóa/thẻ hộ</Text><TextInput placeholder="Họ tên người nhận hộ" placeholderTextColor="#7D8795" style={styles.input} value={draft.fullName} onChangeText={value => updateDelegate(booking.id, 'fullName', value)} /><TextInput placeholder="Mã sinh viên / cán bộ" placeholderTextColor="#7D8795" style={styles.input} value={draft.studentId} onChangeText={value => updateDelegate(booking.id, 'studentId', value)} /><Pressable style={styles.outlineButton} onPress={() => action(() => setPickupDelegate(booking.id, username, draft.fullName, draft.studentId), 'Đã lưu người nhận khóa hộ.')}><Text style={styles.outlineText}>Lưu ủy quyền</Text></Pressable></View>
        </> : null}
        {booking.checkedInAt || booking.checkedOutAt ? <View style={styles.accessBox}>
          <Text style={styles.boxTitle}>Ghi nhận từ SmartLock</Text>
          {booking.checkedInAt ? <Text style={styles.detail}>Check in: {new Date(booking.checkedInAt).toLocaleString('vi-VN')}</Text> : null}
          {booking.checkedOutAt ? <Text style={styles.detail}>Check out: {new Date(booking.checkedOutAt).toLocaleString('vi-VN')}</Text> : null}
        </View> : null}
        {currentlyInUse ? <View style={styles.maintenanceBox}>
          <Text style={styles.boxTitle}>Phòng đang có vấn đề?</Text>
          {pendingMaintenance ? <Text style={styles.waiting}>Yêu cầu bảo trì đang chờ quản trị viên xử lý: {pendingMaintenance.reason}</Text> : <>
            <TextInput multiline placeholder="Mô tả sự cố / lý do bảo trì" placeholderTextColor="#7D8795" style={[styles.input, styles.reasonInput]} value={maintenanceReasons[booking.id] ?? ''} onChangeText={value => setMaintenanceReasons(current => ({ ...current, [booking.id]: value }))} />
            <Pressable style={styles.maintenanceButton} onPress={() => action(() => requestRoomMaintenance(booking.id, username, maintenanceReasons[booking.id] ?? ''), 'Đã gửi yêu cầu bảo trì tới quản trị viên.')}><Text style={styles.maintenanceButtonText}>Yêu cầu bảo trì phòng này</Text></Pressable>
          </>}
        </View> : null}
        <Pressable style={styles.cancelButton} onPress={() => action(() => cancelBooking(booking.id, username), 'Đã hủy đặt phòng và thu hồi quyền truy cập liên quan.')}><Text style={styles.cancelText}>{booking.status === 'PENDING' ? 'Rút yêu cầu' : 'Hủy đặt phòng'}</Text></Pressable>
      </View>;
    })}
  </ScrollView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 18, paddingBottom: 40 }, message: { backgroundColor: '#EDF5FF', borderRadius: 9, color: '#24598F', marginBottom: 12, padding: 11 }, empty: { color: '#657084', marginTop: 40, textAlign: 'center' }, card: { backgroundColor: '#FFF', borderColor: '#E1E6EE', borderRadius: 13, borderWidth: 1, marginBottom: 13, padding: 16 }, pinBox: { backgroundColor: '#F4F0FF', borderRadius: 9, marginTop: 13, padding: 12 }, pinLabel: { color: '#5C4778', fontSize: 12, fontWeight: '800' }, pinCode: { color: '#3B235F', fontSize: 24, fontWeight: '900', letterSpacing: 4, marginTop: 6 }, pinTime: { color: '#62547B', fontSize: 11, marginTop: 6 }, link: { color: '#6A42A1', fontWeight: '800', marginTop: 8 }, permission: { backgroundColor: '#F4F0FF', borderRadius: 9, marginTop: 12, padding: 11 }, permissionText: { color: '#5C4778', marginBottom: 8 }, purpleButton: { alignItems: 'center', backgroundColor: '#5A3788', borderRadius: 8, paddingVertical: 10 }, whiteText: { color: '#FFF', fontWeight: '800' }, waiting: { backgroundColor: '#FFF7E7', borderRadius: 8, color: '#765014', marginTop: 8, padding: 10 }, delegateBox: { backgroundColor: '#F7F9FC', borderRadius: 9, marginTop: 12, padding: 11 }, boxTitle: { color: '#344057', fontWeight: '800', marginBottom: 8 }, detail: { color: '#596579', fontSize: 12, marginTop: 4 }, helperText: { color: '#657084', fontSize: 12, lineHeight: 17, marginBottom: 8 }, agreedBox: { backgroundColor: '#E9F7EF', borderRadius: 8, marginBottom: 8, padding: 10 }, agreedTitle: { color: '#17613A', fontWeight: '800' }, counterBox: { backgroundColor: '#EDF5FF', borderRadius: 8, marginBottom: 8, padding: 10 }, accessBox: { backgroundColor: '#EEF7F7', borderRadius: 9, marginTop: 12, padding: 11 }, maintenanceBox: { backgroundColor: '#FFF8E1', borderColor: '#E2B83B', borderRadius: 9, borderWidth: 1, marginTop: 12, padding: 11 }, reasonInput: { minHeight: 72, textAlignVertical: 'top' }, maintenanceButton: { alignItems: 'center', backgroundColor: '#B7791F', borderRadius: 8, paddingVertical: 10 }, maintenanceButtonText: { color: '#FFF', fontWeight: '800' }, input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 8, borderWidth: 1, color: '#172033', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 9 }, outlineButton: { alignItems: 'center', borderColor: '#386E9F', borderRadius: 8, borderWidth: 1, paddingVertical: 9 }, outlineText: { color: '#315A86', fontWeight: '800' }, cancelButton: { alignSelf: 'flex-start', marginTop: 13, paddingVertical: 5 }, cancelText: { color: '#B01432', fontSize: 13, fontWeight: '800' } });
