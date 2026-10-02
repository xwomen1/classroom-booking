import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../../shared';
import { createTemporaryPin, getPinDisplayStatus, getRoomPinPermissions } from '../../access_control';
import { getRooms, type Room } from '../../room_management';
import {
  connectOneIoT,
  getOneIoTConnectionStatus,
} from '../../smart_lock/services/oneIoTClient';
import { getManagedSmartLock } from '../../smart_lock/services/smartLockRepository';
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
  cancelFutureRecurringBookings,
  getBookingsForUser,
  proposeKeyPickup,
  setPickupDelegate,
  toLocalDateTime,
  updatePendingRecurringBookings,
} from '../services/bookingRepository';

const PIN_STATUS_LABEL = { PENDING: 'Chưa đến thời gian hiệu lực', ACTIVE: 'Đang có hiệu lực', EXPIRED: 'Đã hết hạn', REVOKED: 'Đã thu hồi' };
type DelegateDraft = { fullName: string; studentId: string };
type PickupDraft = { date: string; time: string };
type SeriesEditDraft = Pick<Booking, 'startTime' | 'endTime' | 'purpose'>;

const seriesStyles = StyleSheet.create({
  occurrence: { alignSelf: 'flex-start', backgroundColor: '#EAF4FF', borderRadius: 6, color: '#24598F', fontSize: 11, fontWeight: '700', marginTop: 8, paddingHorizontal: 8, paddingVertical: 5 },
  box: { backgroundColor: '#F4F8FC', borderColor: '#D5E1EC', borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 10 },
  title: { color: '#26384D', fontSize: 13, fontWeight: '800' },
  detail: { color: '#657084', fontSize: 11, lineHeight: 16, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  action: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#AFC9DE', borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 40, minWidth: 130, paddingHorizontal: 8, paddingVertical: 7 },
  actionText: { color: '#1769AA', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  cancelAction: { alignItems: 'center', backgroundColor: '#FFF7F5', borderColor: '#E4C1BB', borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 40, minWidth: 130, paddingHorizontal: 8, paddingVertical: 7 },
  cancelText: { color: '#A53A32', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  editor: { borderTopColor: '#DDE6EE', borderTopWidth: 1, marginTop: 10, paddingTop: 9 },
  editorHint: { color: '#657084', fontSize: 11, lineHeight: 16, marginBottom: 7 },
  saveAction: { alignItems: 'center', backgroundColor: '#1769AA', borderRadius: 7, marginTop: 4, paddingVertical: 10 },
  saveText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});

export function MyBookingsScreen({ username, onBack }: { username: string; onBack: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [revealedPinId, setRevealedPinId] = useState<string | null>(null); const [message, setMessage] = useState(''); const [delegates, setDelegates] = useState<Record<string, DelegateDraft>>({});
  const [permittedRoomIds, setPermittedRoomIds] = useState<string[]>([]);
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, PickupDraft>>({});
  const [maintenanceReasons, setMaintenanceReasons] = useState<Record<string, string>>({});
  const [seriesDrafts, setSeriesDrafts] = useState<Record<string, SeriesEditDraft>>({});
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [oneIotToken, setOneIotToken] = useState('');
  const [oneIotConnected, setOneIotConnected] = useState(false);
  const [oneIotWorking, setOneIotWorking] = useState(false);
  const load = useCallback(async () => {
    const [items, roomItems, permissionItems, requestItems, oneIotStatus] = await Promise.all([
      getBookingsForUser(username),
      getRooms(),
      getRoomPinPermissions(),
      getMaintenanceRequests(),
      getOneIoTConnectionStatus(),
    ]);
    setBookings(items);
    setRooms(roomItems);
    setPermittedRoomIds(permissionItems.filter(item => item.username === username && item.active).map(item => item.roomId));
    setMaintenanceRequests(requestItems.filter(item => item.requesterUsername === username));
    setOneIotConnected(oneIotStatus.connected);
  }, [username]);
  useEffect(() => { load(); }, [load]);
  const active = bookings.filter(item => ['PENDING', 'APPROVED'].includes(item.status) && toLocalDateTime(item.date, item.endTime) > new Date());
  const needsOneIoTConnection = active.some(booking => {
    const room = rooms.find(item => item.id === booking.roomId);
    const hasPin = Boolean(booking.temporaryPin && !booking.temporaryPin.revokedAt);
    return booking.status === 'APPROVED' && room?.lockType === 'PIN_CODE' &&
      permittedRoomIds.includes(booking.roomId) && !hasPin;
  });
  const action = async (operation: () => Promise<unknown>, success: string) => { try { await operation(); setMessage(success); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.'); } };
  const checkOneIoT = async () => {
    setOneIotWorking(true);
    try {
      const managedLock = await getManagedSmartLock();
      const status = await connectOneIoT(managedLock, oneIotToken);
      setOneIotConnected(status.connected);
      setMessage(status.connected ? 'Đã kết nối OneIoT cho phiên hiện tại.' : 'OneIoT chưa xác nhận kết nối.');
    } catch (error) {
      setOneIotConnected(false);
      setMessage(error instanceof Error ? error.message : 'Không thể kết nối OneIoT.');
    } finally {
      setOneIotWorking(false);
    }
  };
  const createPinForBooking = async (bookingId: string) => {
    const status = await getOneIoTConnectionStatus();
    setOneIotConnected(status.connected);
    if (!status.connected) {
      setMessage('Phiên OneIoT chưa kết nối hoặc đã bị ngắt. Hãy nhập token và kiểm tra kết nối trước.');
      return;
    }
    await action(() => createTemporaryPin(bookingId, username, 'user'), 'Đã tạo mật khẩu tạm thời.');
  };
  const updateDelegate = (id: string, field: keyof DelegateDraft, value: string) => setDelegates(current => ({ ...current, [id]: { ...(current[id] ?? { fullName: '', studentId: '' }), [field]: value } }));
  const updatePickup = (id: string, field: keyof PickupDraft, value: string) => setPickupDrafts(current => ({ ...current, [id]: { ...(current[id] ?? { date: '', time: '' }), [field]: value } }));
  const updateSeriesDraft = (booking: Booking, field: keyof SeriesEditDraft, value: string) => {
    if (!booking.recurringSeriesId) return;
    setSeriesDrafts(current => ({
      ...current,
      [booking.recurringSeriesId!]: {
        ...(current[booking.recurringSeriesId!] ?? {
          startTime: booking.startTime,
          endTime: booking.endTime,
          purpose: booking.purpose,
        }),
        [field]: value,
      },
    }));
  };
  const saveSeriesDraft = async (booking: Booking, changes: SeriesEditDraft) => {
    if (!booking.recurringSeriesId) return;
    try {
      const count = await updatePendingRecurringBookings(booking.id, username, changes);
      setEditingSeriesId(null);
      setMessage(`Đã cập nhật ${count} lượt đang chờ duyệt.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể sửa chuỗi đặt phòng.');
    }
  };
  const cancelSeries = async (booking: Booking) => {
    try {
      const count = await cancelFutureRecurringBookings(booking.id, username);
      setMessage(`Đã hủy ${count} lượt đặt trong tương lai.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể hủy chuỗi đặt phòng.');
    }
  };
  return <View style={styles.page}><ScreenHeader title="Đặt phòng của tôi" onBack={onBack} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {needsOneIoTConnection ? <View style={styles.oneIotBox}>
      <Text style={styles.boxTitle}>Kết nối OneIoT để tạo mật khẩu</Text>
      <Text style={styles.helperText}>Token chỉ được giữ trong phiên app. Sau khi app chuyển nền hoặc đóng, bạn cần kết nối lại.</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setOneIotToken} placeholder="Dán token OneIoT của Tools" placeholderTextColor="#7D8795" secureTextEntry selectTextOnFocus style={styles.input} value={oneIotToken} />
      <View style={styles.connectionStatusRow}><View style={[styles.connectionDot, oneIotConnected ? styles.connectedDot : styles.disconnectedDot]} /><Text style={styles.connectionStatusText}>{oneIotConnected ? 'Đã kết nối' : 'Chưa kết nối'}</Text></View>
      <Pressable disabled={oneIotWorking} style={[styles.purpleButton, oneIotWorking && styles.disabledButton]} onPress={checkOneIoT}><Text style={styles.whiteText}>{oneIotWorking ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</Text></Pressable>
    </View> : null}
    {active.length === 0 ? <Text style={styles.empty}>Không có yêu cầu đang chờ hoặc sắp sử dụng.</Text> : active.map(booking => {
      const room = rooms.find(item => item.id === booking.roomId); const pin = booking.temporaryPin?.revokedAt ? undefined : booking.temporaryPin; const reveal = revealedPinId === booking.id; const pinStatus = getPinDisplayStatus(booking); const draft = delegates[booking.id] ?? { fullName: '', studentId: '' };
      const seriesBookings = booking.recurringSeriesId ? active
        .filter(item => item.recurringSeriesId === booking.recurringSeriesId)
        .sort((left, right) => `${left.date}${left.startTime}`.localeCompare(`${right.date}${right.startTime}`)) : [];
      const isSeriesLead = seriesBookings[0]?.id === booking.id;
      const futureSeriesBookings = seriesBookings.filter(item => toLocalDateTime(item.date, item.startTime) > new Date());
      const pendingSeriesCount = futureSeriesBookings.filter(item => item.status === 'PENDING').length;
      const seriesDraft = booking.recurringSeriesId
        ? seriesDrafts[booking.recurringSeriesId] ?? { startTime: booking.startTime, endTime: booking.endTime, purpose: booking.purpose }
        : undefined;
      const pickupDraft = pickupDrafts[booking.id] ?? { date: booking.date, time: '' };
      const pickupNegotiation = booking.keyPickupNegotiation;
      const pendingMaintenance = maintenanceRequests.find(item => item.bookingId === booking.id && item.status === 'PENDING');
      const now = new Date();
      const currentlyInUse = booking.status === 'APPROVED' &&
        now >= toLocalDateTime(booking.date, booking.startTime) &&
        now <= toLocalDateTime(booking.date, booking.endTime);
      const canCreatePin = permittedRoomIds.includes(booking.roomId);
      return <View key={booking.id} style={styles.card}><BookingInfo booking={booking} />
        {booking.recurringSeriesId ? <Text style={seriesStyles.occurrence}>Chuỗi hàng tuần · Tuần {(booking.recurringWeekIndex ?? 0) + 1}/{booking.repeatWeeks ?? seriesBookings.length}</Text> : null}
        {isSeriesLead ? <View style={seriesStyles.box}>
          <Text style={seriesStyles.title}>Các lượt còn trong chuỗi</Text>
          <Text style={seriesStyles.detail}>{futureSeriesBookings.length} lượt trong tương lai · chỉnh sửa áp dụng cho lượt đang chờ duyệt</Text>
          <View style={seriesStyles.actions}>
            <Pressable
              disabled={pendingSeriesCount === 0}
              onPress={() => {
                const seriesId = booking.recurringSeriesId!;
                setEditingSeriesId(current => current === seriesId ? null : seriesId);
              }}
              style={[seriesStyles.action, pendingSeriesCount === 0 && seriesStyles.disabled]}
            >
              <Text style={seriesStyles.actionText}>{editingSeriesId === booking.recurringSeriesId ? 'Đóng chỉnh sửa' : 'Sửa lịch chờ duyệt'}</Text>
            </Pressable>
            <Pressable
              disabled={futureSeriesBookings.length === 0}
              onPress={() => Alert.alert(
                'Hủy các lượt đặt tương lai?',
                `Sẽ hủy ${futureSeriesBookings.length} lượt trong chuỗi. Lượt đang diễn ra không bị ảnh hưởng.`,
                [
                  { text: 'Giữ lại', style: 'cancel' },
                  { text: 'Hủy các lượt', style: 'destructive', onPress: () => cancelSeries(booking) },
                ],
              )}
              style={[seriesStyles.cancelAction, futureSeriesBookings.length === 0 && seriesStyles.disabled]}
            >
              <Text style={seriesStyles.cancelText}>Hủy các lượt tương lai</Text>
            </Pressable>
          </View>
          {editingSeriesId === booking.recurringSeriesId && seriesDraft ? <View style={seriesStyles.editor}>
            <Text style={seriesStyles.editorHint}>Chỉ các lượt chưa bắt đầu và đang chờ duyệt sẽ được cập nhật.</Text>
            <TextInput
              accessibilityLabel="Giờ bắt đầu mới"
              placeholder="Giờ bắt đầu (HH:mm)"
              placeholderTextColor="#7D8795"
              style={styles.input}
              value={seriesDraft.startTime}
              onChangeText={value => updateSeriesDraft(booking, 'startTime', value)}
            />
            <TextInput
              accessibilityLabel="Giờ kết thúc mới"
              placeholder="Giờ kết thúc (HH:mm)"
              placeholderTextColor="#7D8795"
              style={styles.input}
              value={seriesDraft.endTime}
              onChangeText={value => updateSeriesDraft(booking, 'endTime', value)}
            />
            <TextInput
              accessibilityLabel="Mục đích sử dụng mới"
              placeholder="Mục đích sử dụng"
              placeholderTextColor="#7D8795"
              style={styles.input}
              value={seriesDraft.purpose}
              onChangeText={value => updateSeriesDraft(booking, 'purpose', value)}
            />
            <Pressable style={seriesStyles.saveAction} onPress={() => saveSeriesDraft(booking, seriesDraft)}>
              <Text style={seriesStyles.saveText}>Lưu cho các tuần còn lại</Text>
            </Pressable>
          </View> : null}
        </View> : null}
        {pin ? <View style={styles.pinBox}><Text style={styles.pinLabel}>Mã mở cửa · {pinStatus ? PIN_STATUS_LABEL[pinStatus] : ''}</Text><Text style={styles.pinCode}>{reveal ? pin.code : '••••••'}</Text><Text style={styles.pinTime}>Hiệu lực: {new Date(pin.validFrom).toLocaleString('vi-VN')} – {new Date(pin.validUntil).toLocaleString('vi-VN')}</Text><Pressable onPress={() => setRevealedPinId(reveal ? null : booking.id)}><Text style={styles.link}>{reveal ? 'Ẩn mã' : 'Xem mã'}</Text></Pressable></View> : null}
        {!pin && booking.status === 'APPROVED' && room?.lockType === 'PIN_CODE' && canCreatePin ? <View style={styles.permission}><Text style={styles.permissionText}>Bạn có quyền tự tạo mã cho riêng phòng {room.name}.</Text><Pressable disabled={!oneIotConnected} style={[styles.purpleButton, !oneIotConnected && styles.disabledButton]} onPress={() => createPinForBooking(booking.id)}><Text style={styles.whiteText}>{oneIotConnected ? 'Tạo mật khẩu tạm thời' : 'Kết nối OneIoT trước'}</Text></Pressable></View> : null}
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
          <Text style={styles.boxTitle}>{booking.checkInConfirmedBy ? 'Check-in xác nhận bởi Admin' : 'Ghi nhận từ SmartLock'}</Text>
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
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 18, paddingBottom: 40 }, message: { backgroundColor: '#EDF5FF', borderRadius: 9, color: '#24598F', marginBottom: 12, padding: 11 }, empty: { color: '#657084', marginTop: 40, textAlign: 'center' }, card: { backgroundColor: '#FFF', borderColor: '#E1E6EE', borderRadius: 13, borderWidth: 1, marginBottom: 13, padding: 16 }, oneIotBox: { backgroundColor: '#F4F0FF', borderColor: '#D8CBEA', borderRadius: 11, borderWidth: 1, marginBottom: 13, padding: 13 }, connectionStatusRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 }, connectionDot: { borderRadius: 5, height: 10, marginRight: 7, width: 10 }, connectedDot: { backgroundColor: '#259A58' }, disconnectedDot: { backgroundColor: '#C7364F' }, connectionStatusText: { color: '#4A566B', fontSize: 13, fontWeight: '700' }, pinBox: { backgroundColor: '#F4F0FF', borderRadius: 9, marginTop: 13, padding: 12 }, pinLabel: { color: '#5C4778', fontSize: 12, fontWeight: '800' }, pinCode: { color: '#3B235F', fontSize: 24, fontWeight: '900', letterSpacing: 4, marginTop: 6 }, pinTime: { color: '#62547B', fontSize: 11, marginTop: 6 }, link: { color: '#6A42A1', fontWeight: '800', marginTop: 8 }, permission: { backgroundColor: '#F4F0FF', borderRadius: 9, marginTop: 12, padding: 11 }, permissionText: { color: '#5C4778', marginBottom: 8 }, purpleButton: { alignItems: 'center', backgroundColor: '#5A3788', borderRadius: 8, paddingVertical: 10 }, disabledButton: { backgroundColor: '#A9A1B4', opacity: 0.75 }, whiteText: { color: '#FFF', fontWeight: '800' }, waiting: { backgroundColor: '#FFF7E7', borderRadius: 8, color: '#765014', marginTop: 8, padding: 10 }, delegateBox: { backgroundColor: '#F7F9FC', borderRadius: 9, marginTop: 12, padding: 11 }, boxTitle: { color: '#344057', fontWeight: '800', marginBottom: 8 }, detail: { color: '#596579', fontSize: 12, marginTop: 4 }, helperText: { color: '#657084', fontSize: 12, lineHeight: 17, marginBottom: 8 }, agreedBox: { backgroundColor: '#E9F7EF', borderRadius: 8, marginBottom: 8, padding: 10 }, agreedTitle: { color: '#17613A', fontWeight: '800' }, counterBox: { backgroundColor: '#EDF5FF', borderRadius: 8, marginBottom: 8, padding: 10 }, accessBox: { backgroundColor: '#EEF7F7', borderRadius: 9, marginTop: 12, padding: 11 }, maintenanceBox: { backgroundColor: '#FFF8E1', borderColor: '#E2B83B', borderRadius: 9, borderWidth: 1, marginTop: 12, padding: 11 }, reasonInput: { minHeight: 72, textAlignVertical: 'top' }, maintenanceButton: { alignItems: 'center', backgroundColor: '#B7791F', borderRadius: 8, paddingVertical: 10 }, maintenanceButtonText: { color: '#FFF', fontWeight: '800' }, input: { backgroundColor: '#FFF', borderColor: '#CBD4E1', borderRadius: 8, borderWidth: 1, color: '#172033', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 9 }, outlineButton: { alignItems: 'center', borderColor: '#386E9F', borderRadius: 8, borderWidth: 1, paddingVertical: 9 }, outlineText: { color: '#315A86', fontWeight: '800' }, cancelButton: { alignSelf: 'flex-start', marginTop: 13, paddingVertical: 5 }, cancelText: { color: '#B01432', fontSize: 13, fontWeight: '800' } });
