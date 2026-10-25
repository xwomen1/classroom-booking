/* eslint-env jest */
import React from 'react';
import { AccountManagementScreen } from '../../src/modules/account_management/screens/AccountManagementScreen';
import { authenticate, getAccounts } from '../../src/modules/auth';
import { grantRoomPinPermission, hasRoomPinPermission } from '../../src/modules/access_control';
import {
  findInputByLabel,
  findPressable,
  press,
  render,
  resetStorage,
  textContent,
  typeInto,
  unmount,
} from '../support/testUtils';
import ReactTestRenderer from 'react-test-renderer';

async function renderScreen() {
  return render(<AccountManagementScreen adminUsername="admin" onBack={jest.fn()} />);
}

/** Thẻ tài khoản chứa "@username"; dùng để bấm đúng nút của tài khoản đó. */
function card(root: ReactTestRenderer.ReactTestInstance, username: string) {
  const cards = root.findAll(node =>
    typeof node.type !== 'string' && textContent(node).startsWith(`@${username}`));
  if (cards.length === 0) throw new Error(`Không tìm thấy thẻ @${username}`);
  return cards[0].parent!;
}

beforeEach(async () => {
  await resetStorage();
});

test('lists only user accounts, never admins', async () => {
  const screen = await renderScreen();
  const text = textContent(screen.root);
  expect(text).toContain('@user');
  expect(text).not.toContain('@admin');
  expect(text).toContain('Chưa có quyền ở phòng nào.');
  await unmount(screen);
});

test('creates a lecturer account and shows errors from validation', async () => {
  const screen = await renderScreen();
  await press(screen.root, 'Thêm tài khoản');
  expect(textContent(screen.root)).toContain('Tên đăng nhập cần 3–30 ký tự');

  await typeInto(findInputByLabel(screen.root, 'Tên đăng nhập'), 'gv01');
  await typeInto(findInputByLabel(screen.root, 'Mật khẩu ban đầu'), 'abcd');
  await typeInto(findInputByLabel(screen.root, 'Mã khôi phục'), '1234');
  await press(screen.root, 'Thêm tài khoản');

  expect(textContent(screen.root)).toContain('Đã thêm tài khoản giảng viên.');
  expect(textContent(screen.root)).toContain('@gv01');
  expect(findInputByLabel(screen.root, 'Tên đăng nhập').props.value).toBe('');
  expect(await authenticate('gv01', 'abcd')).toEqual({ username: 'gv01', role: 'user' });
  await unmount(screen);
});

test('search filters accounts by username', async () => {
  const screen = await renderScreen();
  await typeInto(findInputByLabel(screen.root, 'Tìm theo tên đăng nhập'), 'zzz');
  expect(textContent(screen.root)).not.toContain('@user');
  await typeInto(findInputByLabel(screen.root, 'Tìm theo tên đăng nhập'), ' US');
  expect(textContent(screen.root)).toContain('@user');
  await unmount(screen);
});

test('locks and unlocks an account', async () => {
  const screen = await renderScreen();
  await press(card(screen.root, 'user'), 'Khóa');
  expect(textContent(screen.root)).toContain('ĐÃ KHÓA');
  expect(await authenticate('user', '2')).toBeNull();

  await press(card(screen.root, 'user'), 'Mở khóa');
  expect(textContent(card(screen.root, 'user'))).toContain('USER');
  expect(await authenticate('user', '2')).not.toBeNull();
  await unmount(screen);
});

test('resets a password to 1234', async () => {
  const screen = await renderScreen();
  await press(card(screen.root, 'user'), 'Đặt MK: 1234');
  expect(await authenticate('user', '1234')).not.toBeNull();
  await unmount(screen);
});

test('deletes an account', async () => {
  const screen = await renderScreen();
  await press(card(screen.root, 'user'), 'Xóa');
  expect(textContent(screen.root)).toContain('Đã xóa tài khoản.');
  expect((await getAccounts()).map(item => item.username)).toEqual(['admin']);
  await unmount(screen);
});

test('shows and revokes a room PIN permission', async () => {
  await grantRoomPinPermission('user', 'room-a101', 'admin');
  const screen = await renderScreen();
  expect(textContent(card(screen.root, 'user'))).toContain('101');
  await press(card(screen.root, 'user'), 'Thu hồi');
  expect(textContent(screen.root)).toContain('Đã thu hồi quyền tự tạo mật khẩu của đúng phòng đã chọn.');
  expect(await hasRoomPinPermission('user', 'room-a101')).toBe(false);
  expect(() => findPressable(card(screen.root, 'user'), 'Thu hồi')).toThrow();
  await unmount(screen);
});
