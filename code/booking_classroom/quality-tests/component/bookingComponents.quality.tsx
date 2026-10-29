/* eslint-env jest */
import React from 'react';
import { Alert, Platform, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  BookingTimePicker,
  TIME_OPTIONS,
  buildDateOptions,
} from '../../src/modules/booking/components/BookingTimePicker';
import { MyBookingsScreen } from '../../src/modules/booking/screens/MyBookingsScreen';
import { getBookingById } from '../../src/modules/booking';
import { getNotifications } from '../../src/modules/notifications';
import { getMaintenanceRequests } from '../../src/modules/schedule_maintenance';
import { grantRoomPinPermission } from '../../src/modules/access_control';
import { assignSmartLockToRoom } from '../../src/modules/smart_lock';
import { PasswordInput } from '../../src/shared';
import {
  dayOffset,
  findInputByTestId,
  findPressable,
  makeBooking,
  press,
  render,
  resetStorage,
  seedBookings,
  textContent,
  typeInto,
  unmount,
} from '../support/testUtils';

beforeEach(async () => {
  await resetStorage();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BookingTimePicker', () => {
  test('time options run every 30 minutes from 07:00 to 21:00', () => {
    expect(TIME_OPTIONS[0]).toBe('07:00');
    expect(TIME_OPTIONS[1]).toBe('07:30');
    expect(TIME_OPTIONS[TIME_OPTIONS.length - 1]).toBe('21:00');
    expect(TIME_OPTIONS).toHaveLength(29);
  });

  test('buildDateOptions covers the min..max window inclusively', () => {
    expect(buildDateOptions(1, 3)).toEqual([dayOffset(1), dayOffset(2), dayOffset(3)]);
    expect(buildDateOptions(0, 0)).toEqual([dayOffset(0)]);
  });

  function renderPicker(startTime = '09:00', endTime = '10:00') {
    const handlers = { onDateChange: jest.fn(), onStartTimeChange: jest.fn(), onEndTimeChange: jest.fn() };
    const element = (
      <BookingTimePicker
        dateOptions={['2030-01-11', '2030-01-12']}
        date="2030-01-11"
        startTime={startTime}
        endTime={endTime}
        {...handlers}
      />
    );
    return { handlers, element };
  }

  test('renders dates as dd/mm and a summary line', async () => {
    const { element } = renderPicker();
    const screen = await render(element);
    const text = textContent(screen.root);
    expect(text).toContain('11/01');
    expect(text).toContain('12/01');
    expect(text).toContain('2030-01-11 · 09:00–10:00');
    await unmount(screen);
  });

  test('end-time column only offers times after the start', async () => {
    const { element } = renderPicker('20:00', '20:30');
    const screen = await render(element);
    const columns = screen.root.findAll(node => typeof node.props.nestedScrollEnabled === 'boolean' && typeof node.type !== 'string');
    const endColumn = textContent(columns[columns.length - 1]);
    expect(endColumn).toBe('20:3021:00');
    await unmount(screen);
  });

  test('choosing a start at or after the end pushes the end 30 minutes later', async () => {
    const { element, handlers } = renderPicker('09:00', '10:00');
    const screen = await render(element);
    const startButtons = screen.root.findAll(node => typeof node.props.onPress === 'function' && textContent(node) === '10:30');
    await ReactTestRenderer.act(async () => { startButtons[0].props.onPress(); });
    expect(handlers.onStartTimeChange).toHaveBeenCalledWith('10:30');
    expect(handlers.onEndTimeChange).toHaveBeenCalledWith('11:00');
    await unmount(screen);
  });

  test('choosing an earlier start leaves the end untouched', async () => {
    const { element, handlers } = renderPicker('09:00', '10:00');
    const screen = await render(element);
    const button = screen.root.findAll(node => typeof node.props.onPress === 'function' && textContent(node) === '08:00')[0];
    await ReactTestRenderer.act(async () => { button.props.onPress(); });
    expect(handlers.onEndTimeChange).not.toHaveBeenCalled();
    await unmount(screen);
  });

  test('pressing a date reports it', async () => {
    const { element, handlers } = renderPicker();
    const screen = await render(element);
    await press(screen.root, '12/01');
    expect(handlers.onDateChange).toHaveBeenCalledWith('2030-01-12');
    await unmount(screen);
  });
});

describe('PasswordInput', () => {
  test('iOS uses the native secure entry', async () => {
    const screen = await render(<PasswordInput value="abc" onChangeText={jest.fn()} />);
    const input = screen.root.findByType(TextInput);
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.value).toBe('abc');
    await unmount(screen);
  });

  describe('Android custom mask', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    async function edit(current: string, displayed: string) {
      const onChangeText = jest.fn();
      const screen = await render(<PasswordInput value={current} onChangeText={onChangeText} />);
      const input = screen.root.findByType(TextInput);
      await ReactTestRenderer.act(async () => { input.props.onChangeText(displayed); });
      await unmount(screen);
      return { onChangeText, input };
    }

    test('shows bullets instead of the real value', async () => {
      const screen = await render(<PasswordInput value="secret" onChangeText={jest.fn()} />);
      const input = screen.root.findByType(TextInput);
      expect(input.props.value).toBe('••••••');
      expect(input.props.secureTextEntry).toBe(false);
      await unmount(screen);
    });

    test.each([
      ['ab', '••c', 'abc'],
      ['abc', '••', 'ab'],
      ['abc', '', ''],
      ['ab', '••xy', 'abxy'],
      ['abc', '•z•', 'azb'],
    ])('current=%s displayed=%s → %s', async (current, displayed, expected) => {
      const { onChangeText } = await edit(current, displayed);
      expect(onChangeText).toHaveBeenCalledWith(expected);
    });
  });
});

describe('MyBookingsScreen', () => {
  test('sends a minor room observation without requesting maintenance', async () => {
    await seedBookings([makeBooking({
      id: 'current', date: dayOffset(0), startTime: '00:00', endTime: '23:59', status: 'APPROVED',
    })]);
    const screen = await render(<MyBookingsScreen username="user" onBack={jest.fn()} />);
    expect(textContent(screen.root)).toContain('Mục này không tạo yêu cầu bảo trì.');
    await typeInto(findInputByTestId(screen.root, 'room-observation-current'), 'Thiếu bút viết bảng');
    await press(screen.root, 'Gửi ghi chú');
    expect(textContent(screen.root)).toContain('Đã gửi ghi chú về phòng tới quản trị viên.');
    expect((await getNotifications('admin'))[0].message).toContain('Thiếu bút viết bảng');
    expect(await getMaintenanceRequests()).toHaveLength(0);
    await unmount(screen);
  });

  test('lists the user\'s active bookings with the right action labels', async () => {
    await seedBookings([
      makeBooking({ id: 'p', date: dayOffset(2), purpose: 'Seminar AI' }),
      makeBooking({ id: 'a', date: dayOffset(3), status: 'APPROVED', roomId: 'room-floor-1-3', purpose: 'Bảo vệ đồ án' }),
      makeBooking({ id: 'x', date: dayOffset(2), requesterUsername: 'someone', purpose: 'Không phải của tôi' }),
    ]);
    const screen = await render(<MyBookingsScreen username="user" onBack={jest.fn()} />);
    const text = textContent(screen.root);
    expect(text).toContain('Seminar AI');
    expect(text).toContain('Bảo vệ đồ án');
    expect(text).not.toContain('Không phải của tôi');
    expect(text).toContain('Rút yêu cầu');
    expect(text).toContain('Hủy đặt phòng');
    expect(text).toContain('Thỏa thuận thời gian nhận khóa / thẻ');
    await unmount(screen);
  });

  test('withdrawing a pending request cancels it', async () => {
    await seedBookings([makeBooking({ id: 'p', date: dayOffset(2), purpose: 'Seminar AI' })]);
    const screen = await render(<MyBookingsScreen username="user" onBack={jest.fn()} />);
    await press(screen.root, 'Rút yêu cầu');
    expect(textContent(screen.root)).toContain('Đã hủy đặt phòng và thu hồi quyền truy cập liên quan.');
    expect((await getBookingById('p'))?.status).toBe('CANCELLED');
    await unmount(screen);
  });

  test('a user with room permission can create a PIN that starts hidden', async () => {
    await assignSmartLockToRoom('room-a101', 'admin');
    await grantRoomPinPermission('user', 'room-a101', 'admin');
    await seedBookings([makeBooking({ id: 'a', date: dayOffset(2), status: 'APPROVED' })]);
    const screen = await render(<MyBookingsScreen username="user" onBack={jest.fn()} />);
    expect(textContent(screen.root)).toContain('Bạn có quyền tự tạo mã cho riêng phòng 101.');

    await press(screen.root, 'Tạo mật khẩu tạm thời');

    const code = (await getBookingById('a'))?.temporaryPin?.code;
    expect(code).toMatch(/^\d{7}$/);
    expect(textContent(screen.root)).toContain('Lệnh đang chờ kết nối OneIoT');
    expect(textContent(screen.root)).not.toContain(code!);
    await unmount(screen);
  });

  test('cancelling a series asks for confirmation first', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await seedBookings([
      makeBooking({ id: 's0', date: dayOffset(2), recurringSeriesId: 'series', recurringWeekIndex: 0, repeatWeekly: true, repeatWeeks: 2 }),
      makeBooking({ id: 's1', date: dayOffset(9), recurringSeriesId: 'series', recurringWeekIndex: 1, repeatWeekly: true, repeatWeeks: 2 }),
    ]);
    const screen = await render(<MyBookingsScreen username="user" onBack={jest.fn()} />);
    await press(screen.root, 'Hủy các lượt tương lai');
    expect(alert).toHaveBeenCalledWith('Hủy các lượt đặt tương lai?', expect.stringContaining('Sẽ hủy 2 lượt'), expect.any(Array));
    expect((await getBookingById('s0'))?.status).toBe('PENDING');

    const buttons = alert.mock.calls[0][2]!;
    await ReactTestRenderer.act(async () => {
      await buttons.find(button => button.text === 'Hủy các lượt')!.onPress!();
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    expect((await getBookingById('s1'))?.status).toBe('CANCELLED');
    expect(() => findPressable(screen.root, 'Rút yêu cầu')).toThrow();
    await unmount(screen);
  });
});
