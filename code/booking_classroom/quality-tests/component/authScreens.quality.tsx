/* eslint-env jest */
import React from 'react';
import { LoginScreen } from '../../src/modules/auth/screens/LoginScreen';
import { RegistrationScreen } from '../../src/modules/auth/screens/RegistrationScreen';
import { ChangePasswordScreen } from '../../src/modules/auth/screens/ChangePasswordScreen';
import { ForgotPasswordScreen } from '../../src/modules/auth/screens/ForgotPasswordScreen';
import { authenticate } from '../../src/modules/auth';
import { getProfile } from '../../src/modules/profile';
import { getNotifications } from '../../src/modules/notifications';
import {
  findInputByLabel,
  findInputByTestId,
  press,
  render,
  resetStorage,
  textContent,
  typeInto,
  unmount,
} from '../support/testUtils';

beforeEach(async () => {
  await resetStorage();
});

describe('LoginScreen', () => {
  test('asks for both fields before calling the repository', async () => {
    const onLogin = jest.fn();
    const screen = await render(<LoginScreen onLogin={onLogin} />);
    await press(screen.root, 'Đăng nhập');
    expect(textContent(screen.root)).toContain('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
    expect(onLogin).not.toHaveBeenCalled();
    await unmount(screen);
  });

  test('shows an error for wrong credentials', async () => {
    const onLogin = jest.fn();
    const screen = await render(<LoginScreen onLogin={onLogin} />);
    await typeInto(findInputByTestId(screen.root, 'username-input'), 'admin');
    await typeInto(findInputByTestId(screen.root, 'password-input'), 'wrong');
    await press(screen.root, 'Đăng nhập');
    expect(textContent(screen.root)).toContain('Sai tài khoản hoặc mật khẩu.');
    expect(onLogin).not.toHaveBeenCalled();
    await unmount(screen);
  });

  test.each([
    ['admin', '1', 'admin'],
    ['  USER ', '2', 'user'],
  ])('logs in %s and reports role %s', async (username, password, role) => {
    const onLogin = jest.fn();
    const screen = await render(<LoginScreen onLogin={onLogin} />);
    await typeInto(findInputByTestId(screen.root, 'username-input'), username);
    await typeInto(findInputByTestId(screen.root, 'password-input'), password);
    await press(screen.root, 'Đăng nhập');
    expect(onLogin).toHaveBeenCalledWith({ username: role, role });
    await unmount(screen);
  });

  test('opens registration and forgot-password, and comes back', async () => {
    const screen = await render(<LoginScreen onLogin={jest.fn()} />);
    await press(screen.root, 'Đăng ký');
    expect(textContent(screen.root)).toContain('Đăng ký tài khoản');
    await press(screen.root, '‹');
    expect(textContent(screen.root)).toContain('Đăng nhập để tiếp tục');

    await press(screen.root, 'Quên mật khẩu?');
    expect(textContent(screen.root)).toContain('Nhập mã khôi phục đã đăng ký');
    await unmount(screen);
  });

  test('does not expose demo credentials on the login screen', async () => {
    const screen = await render(<LoginScreen onLogin={jest.fn()} />);
    expect(textContent(screen.root)).not.toContain('Quản trị viên: admin / 1');
    expect(textContent(screen.root)).not.toContain('Giảng viên: user / 2');
    await unmount(screen);
  });
});

describe('RegistrationScreen', () => {
  async function fill(values: Record<string, string>) {
    const screen = await render(<RegistrationScreen onBack={jest.fn()} />);
    for (const [testID, value] of Object.entries(values)) {
      await typeInto(findInputByTestId(screen.root, testID), value);
    }
    await press(screen.root, 'Tạo tài khoản');
    return screen;
  }

  test.each([
    [{ 'register-username': 'abc' }, 'Vui lòng nhập đầy đủ các trường bắt buộc.'],
    [{ 'register-username': 'abc', 'register-password': 'abcd', 'register-confirm-password': 'abcd', 'register-email': 'no-at' }, 'Email chưa đúng định dạng.'],
    [{ 'register-username': 'abc', 'register-password': 'abc', 'register-confirm-password': 'abc' }, 'Mật khẩu cần có ít nhất 4 ký tự.'],
    [{ 'register-username': 'abc', 'register-password': 'abcd', 'register-confirm-password': 'abcd', 'register-recovery-code': '12' }, 'Mã khôi phục cần có ít nhất 4 ký tự.'],
    [{ 'register-username': 'abc', 'register-password': 'abcd', 'register-confirm-password': 'abce' }, 'Hai mật khẩu chưa trùng nhau.'],
    [{ 'register-username': 'admin', 'register-password': 'abcd', 'register-confirm-password': 'abcd', 'register-recovery-code': '9999' }, 'Tên đăng nhập đã tồn tại.'],
  ])('shows a validation error for %o', async (values, message) => {
    const screen = await fill(values);
    expect(textContent(screen.root)).toContain(message);
    await unmount(screen);
  });

  test('registers without the optional recovery code', async () => {
    const screen = await fill({
      'register-username': 'norecovery',
      'register-password': 'abcd',
      'register-confirm-password': 'abcd',
    });
    expect(textContent(screen.root)).toContain('Đăng ký thành công.');
    await unmount(screen);
  });

  test('creates the account, profile and welcome notification', async () => {
    const screen = await fill({
      'register-username': 'Lecturer',
      'register-password': 'abcd',
      'register-confirm-password': 'abcd',
      'register-full-name': ' Trần B ',
      'register-email': 'b@hust.edu.vn',
      'register-recovery-code': '9999',
    });
    expect(textContent(screen.root)).toContain('Đăng ký thành công. Hãy quay lại để đăng nhập.');
    expect(await authenticate('lecturer', 'abcd')).toEqual({ username: 'lecturer', role: 'user' });
    expect(await getProfile('lecturer')).toMatchObject({ fullName: 'Trần B', email: 'b@hust.edu.vn' });
    expect((await getNotifications('lecturer'))[0].title).toBe('Đăng ký thành công');
    await unmount(screen);
  });
});

describe('ChangePasswordScreen', () => {
  async function submit(current: string, next: string, confirm: string) {
    const screen = await render(<ChangePasswordScreen username="user" onBack={jest.fn()} />);
    await typeInto(findInputByTestId(screen.root, 'current-password'), current);
    await typeInto(findInputByTestId(screen.root, 'new-password'), next);
    await typeInto(findInputByTestId(screen.root, 'confirm-new-password'), confirm);
    await press(screen.root, 'Lưu mật khẩu mới');
    return screen;
  }

  test.each([
    ['', '', '', 'Vui lòng nhập đầy đủ thông tin.'],
    ['2', 'abc', 'abc', 'Mật khẩu mới cần có ít nhất 4 ký tự.'],
    ['2', 'abcd', 'abce', 'Hai mật khẩu mới chưa trùng nhau.'],
    ['wrong', 'abcd', 'abcd', 'Mật khẩu hiện tại không đúng.'],
  ])('current=%s new=%s confirm=%s → %s', async (current, next, confirm, message) => {
    const screen = await submit(current, next, confirm);
    expect(textContent(screen.root)).toContain(message);
    await unmount(screen);
  });

  test('changes the password and clears the form', async () => {
    const screen = await submit('2', 'abcd', 'abcd');
    expect(textContent(screen.root)).toContain('Đổi mật khẩu thành công.');
    expect(findInputByTestId(screen.root, 'new-password').props.value).toBe('');
    expect(await authenticate('user', 'abcd')).not.toBeNull();
    await unmount(screen);
  });

  test('back button calls onBack', async () => {
    const onBack = jest.fn();
    const screen = await render(<ChangePasswordScreen username="user" onBack={onBack} />);
    await press(screen.root, '‹');
    expect(onBack).toHaveBeenCalled();
    await unmount(screen);
  });
});

describe('ForgotPasswordScreen', () => {
  async function submit(username: string, code: string, password: string, confirm: string) {
    const screen = await render(<ForgotPasswordScreen onBack={jest.fn()} />);
    await typeInto(findInputByLabel(screen.root, 'Tên đăng nhập'), username);
    await typeInto(findInputByLabel(screen.root, 'Mã khôi phục'), code);
    await typeInto(findInputByLabel(screen.root, 'Mật khẩu mới'), password);
    await typeInto(findInputByLabel(screen.root, 'Nhập lại mật khẩu'), confirm);
    await press(screen.root, 'Đặt lại mật khẩu');
    return screen;
  }

  test('mismatched passwords', async () => {
    const screen = await submit('user', '222222', 'abcd', 'abce');
    expect(textContent(screen.root)).toContain('Hai mật khẩu chưa trùng nhau.');
    await unmount(screen);
  });

  test('wrong recovery code', async () => {
    const screen = await submit('user', '000', 'abcd', 'abcd');
    expect(textContent(screen.root)).toContain('Tài khoản hoặc mã khôi phục không đúng.');
    await unmount(screen);
  });

  test('resets the password', async () => {
    const screen = await submit('user', '222222', 'abcd', 'abcd');
    expect(textContent(screen.root)).toContain('Đã đặt lại mật khẩu.');
    expect(await authenticate('user', 'abcd')).not.toBeNull();
    await unmount(screen);
  });
});
