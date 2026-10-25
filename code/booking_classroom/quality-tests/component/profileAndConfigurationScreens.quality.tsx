/* eslint-env jest */
import React from 'react';
import { Switch, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ProfileScreen } from '../../src/modules/profile/screens/ProfileScreen';
import { ConfigurationScreen } from '../../src/modules/configuration/screens/ConfigurationScreen';
import { getProfile, saveProfile } from '../../src/modules/profile';
import { DEFAULT_CONFIGURATION, getConfiguration } from '../../src/modules/configuration';
import {
  findInputByLabel,
  findInputByTestId,
  press,
  render,
  resetStorage,
  seedConfiguration,
  textContent,
  typeInto,
  unmount,
} from '../support/testUtils';

beforeEach(async () => {
  await resetStorage();
});

describe('ProfileScreen', () => {
  test('loads the stored profile', async () => {
    await saveProfile({ username: 'user', fullName: 'Lê C', email: 'c@x.vn', phone: '0912', department: 'Toán' });
    const screen = await render(<ProfileScreen username="user" onBack={jest.fn()} />);
    expect(findInputByTestId(screen.root, 'profile-full-name').props.value).toBe('Lê C');
    expect(findInputByTestId(screen.root, 'profile-department').props.value).toBe('Toán');
    expect(textContent(screen.root)).toContain('@user');
    expect(textContent(screen.root)).not.toContain('Đang tải...');
    await unmount(screen);
  });

  test('requires a full name and a valid email', async () => {
    const screen = await render(<ProfileScreen username="someone" onBack={jest.fn()} />);
    await press(screen.root, 'Lưu thông tin');
    expect(textContent(screen.root)).toContain('Họ và tên không được để trống.');

    await typeInto(findInputByTestId(screen.root, 'profile-full-name'), 'Ngô D');
    await typeInto(findInputByTestId(screen.root, 'profile-email'), 'invalid');
    await press(screen.root, 'Lưu thông tin');
    expect(textContent(screen.root)).toContain('Email chưa đúng định dạng.');
    await unmount(screen);
  });

  test('trims and saves the profile', async () => {
    const screen = await render(<ProfileScreen username="user" onBack={jest.fn()} />);
    await typeInto(findInputByTestId(screen.root, 'profile-full-name'), '  Phạm E ');
    await typeInto(findInputByTestId(screen.root, 'profile-phone'), ' 0988 ');
    await press(screen.root, 'Lưu thông tin');
    expect(textContent(screen.root)).toContain('Đã lưu thông tin cá nhân.');
    expect(await getProfile('user')).toMatchObject({ fullName: 'Phạm E', phone: '0988' });
    await unmount(screen);
  });

  test('avatar shows the first letter of the name', async () => {
    const screen = await render(<ProfileScreen username="admin" onBack={jest.fn()} />);
    // Hồ sơ mặc định của admin là "Cán bộ quản lý..." nên avatar hiện chữ "C".
    expect(screen.root.findAllByType(Text).some(node => node.props.children === 'C')).toBe(true);
    await unmount(screen);
  });
});

describe('ConfigurationScreen', () => {
  test('shows the stored configuration values', async () => {
    await seedConfiguration({ maxAdvanceDays: 6, noShowGraceMinutes: 20 });
    const screen = await render(<ConfigurationScreen adminUsername="admin" onBack={jest.fn()} />);
    expect(findInputByLabel(screen.root, 'Đặt trước tối đa (ngày)').props.value).toBe('6');
    expect(findInputByLabel(screen.root, 'Thời gian chờ check-in').props.value).toBe('20');
    await unmount(screen);
  });

  test('strips non-digits from numeric input', async () => {
    const screen = await render(<ConfigurationScreen adminUsername="admin" onBack={jest.fn()} />);
    await typeInto(findInputByLabel(screen.root, 'Đặt trước tối đa (ngày)'), '1a2');
    expect(findInputByLabel(screen.root, 'Đặt trước tối đa (ngày)').props.value).toBe('12');
    await unmount(screen);
  });

  test('shows repository validation errors without saving', async () => {
    const screen = await render(<ConfigurationScreen adminUsername="admin" onBack={jest.fn()} />);
    await typeInto(findInputByLabel(screen.root, 'Đặt trước tối thiểu (ngày)'), '5');
    await press(screen.root, 'Lưu quy định');
    expect(textContent(screen.root)).toContain('Số ngày đặt tối thiểu không được lớn hơn tối đa.');
    expect(await getConfiguration()).toEqual(DEFAULT_CONFIGURATION);
    await unmount(screen);
  });

  test('non-admins see a permission error', async () => {
    const screen = await render(<ConfigurationScreen adminUsername="user" onBack={jest.fn()} />);
    await press(screen.root, 'Lưu quy định');
    expect(textContent(screen.root)).toContain('Bạn không có quyền thực hiện thao tác này.');
    await unmount(screen);
  });

  test('saves numeric changes and the notification switch', async () => {
    const screen = await render(<ConfigurationScreen adminUsername="admin" onBack={jest.fn()} />);
    await typeInto(findInputByLabel(screen.root, 'Yêu cầu đang hoạt động tối đa mỗi người'), '4');
    await ReactTestRenderer.act(async () => {
      screen.root.findByType(Switch).props.onValueChange(false);
    });
    await press(screen.root, 'Lưu quy định');
    expect(textContent(screen.root)).toContain('Đã lưu quy định đặt phòng.');
    expect(await getConfiguration()).toMatchObject({ maxActiveBookingsPerUser: 4, notificationsEnabled: false });
    expect(screen.root.findAllByType(TextInput)).toHaveLength(7);
    await unmount(screen);
  });
});
