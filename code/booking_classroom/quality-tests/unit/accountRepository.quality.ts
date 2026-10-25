/* eslint-env jest */
import {
  assertAccountRole,
  authenticate,
  changePassword,
  createManagedAccount,
  deleteManagedAccount,
  getAccounts,
  registerAccount,
  resetPasswordWithRecoveryCode,
  updateManagedAccount,
} from '../../src/modules/auth';
import { readJson, writeJson } from '../../src/core/storage/jsonStorage';
import { makeBooking, resetStorage, seedBookings } from '../support/testUtils';

beforeEach(async () => {
  await resetStorage();
});

describe('getAccounts', () => {
  test('seeds the two demo accounts on first use and persists them', async () => {
    const accounts = await getAccounts();
    expect(accounts.map(item => [item.username, item.role])).toEqual([['admin', 'admin'], ['user', 'user']]);
    expect(await readJson('auth.accounts', null)).toHaveLength(2);
  });

  test('fills missing active flags and recovery codes from older data', async () => {
    await writeJson('auth.accounts', [
      { username: 'admin', password: '1', role: 'admin' },
      { username: 'legacy', password: 'x', role: 'user' },
    ]);
    const accounts = await getAccounts();
    expect(accounts[0]).toMatchObject({ active: true, recoveryCode: '111111' });
    expect(accounts[1]).toMatchObject({ active: true, recoveryCode: '000000' });
  });
});

describe('authenticate', () => {
  test('normalizes the username but not the password', async () => {
    expect(await authenticate('  ADMIN ', '1')).toEqual({ username: 'admin', role: 'admin' });
    expect(await authenticate('user', ' 2')).toBeNull();
  });

  test('a locked account cannot sign in', async () => {
    await updateManagedAccount('user', { active: false }, 'admin');
    expect(await authenticate('user', '2')).toBeNull();
  });
});

describe('registerAccount', () => {
  test.each([
    ['ab', 'pass', undefined, 'Tên đăng nhập cần 3–30 ký tự'],
    ['has space', 'pass', undefined, 'Tên đăng nhập cần 3–30 ký tự'],
    ['tên', 'pass', undefined, 'Tên đăng nhập cần 3–30 ký tự'],
    ['a'.repeat(31), 'pass', undefined, 'Tên đăng nhập cần 3–30 ký tự'],
    ['valid.user', 'abc', undefined, 'Mật khẩu cần ít nhất 4 ký tự.'],
    ['valid.user', 'abcd', '123', 'Mã khôi phục cần ít nhất 4 ký tự.'],
    ['ADMIN', 'abcd', undefined, 'Tên đăng nhập đã tồn tại.'],
  ])('rejects username=%s', async (username, password, recoveryCode, message) => {
    await expect(registerAccount({ username, password, recoveryCode })).rejects.toThrow(message);
  });

  test('creates a lowercase user account with a default recovery code', async () => {
    const created = await registerAccount({ username: ' New.User-1 ', password: 'abcd' });
    expect(created).toEqual({ username: 'new.user-1', role: 'user' });
    const stored = (await getAccounts()).find(item => item.username === 'new.user-1');
    expect(stored).toMatchObject({ recoveryCode: '000000', active: true, role: 'user' });
    expect(await authenticate('new.user-1', 'abcd')).not.toBeNull();
  });
});

describe('assertAccountRole', () => {
  test('passes for the right role and fails otherwise', async () => {
    await expect(assertAccountRole('admin', 'admin')).resolves.toBeUndefined();
    await expect(assertAccountRole('user', 'admin')).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
    await expect(assertAccountRole('admin', 'user')).rejects.toThrow('Tài khoản không hoạt động');
    await expect(assertAccountRole('nobody', 'user')).rejects.toThrow('Tài khoản không hoạt động');
  });

  test('a locked account loses its role', async () => {
    await updateManagedAccount('user', { active: false }, 'admin');
    await expect(assertAccountRole('user', 'user')).rejects.toThrow('Tài khoản không hoạt động');
  });
});

describe('quản lý tài khoản bởi admin', () => {
  test('only admins can create accounts', async () => {
    await expect(createManagedAccount({ username: 'x123', password: 'abcd', recoveryCode: 'abcd', role: 'user' }, 'user'))
      .rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });

  test('createManagedAccount validates input and can create another admin', async () => {
    await expect(createManagedAccount({ username: 'x1', password: 'abcd', recoveryCode: 'abcd', role: 'user' }, 'admin'))
      .rejects.toThrow('Tên đăng nhập cần 3–30 ký tự');
    await expect(createManagedAccount({ username: 'x123', password: 'abc', recoveryCode: 'abcd', role: 'user' }, 'admin'))
      .rejects.toThrow('Mật khẩu và mã khôi phục cần ít nhất 4 ký tự.');
    await expect(createManagedAccount({ username: 'user', password: 'abcd', recoveryCode: 'abcd', role: 'user' }, 'admin'))
      .rejects.toThrow('Tên đăng nhập đã tồn tại.');

    const second = await createManagedAccount({ username: 'Admin2', password: 'abcd', recoveryCode: 'abcd', role: 'admin' }, 'admin');
    expect(second).toMatchObject({ username: 'admin2', role: 'admin', active: true });
    await expect(assertAccountRole('admin2', 'admin')).resolves.toBeUndefined();
  });

  test('an admin cannot lock or demote themselves', async () => {
    await expect(updateManagedAccount('admin', { active: false }, 'admin'))
      .rejects.toThrow('Không thể tự khóa hoặc thay đổi quyền của tài khoản đang đăng nhập.');
    await expect(updateManagedAccount('admin', { role: 'user' }, 'admin'))
      .rejects.toThrow('Không thể tự khóa hoặc thay đổi quyền của tài khoản đang đăng nhập.');
  });

  test('updateManagedAccount validates and persists changes', async () => {
    await expect(updateManagedAccount('ghost', { active: false }, 'admin')).rejects.toThrow('Không tìm thấy tài khoản.');
    await expect(updateManagedAccount('user', { password: '12' }, 'admin')).rejects.toThrow('Mật khẩu cần ít nhất 4 ký tự.');
    await expect(updateManagedAccount('user', { recoveryCode: '12' }, 'admin')).rejects.toThrow('Mã khôi phục cần ít nhất 4 ký tự.');
    await updateManagedAccount('user', { password: '1234' }, 'admin');
    expect(await authenticate('user', '1234')).not.toBeNull();
    expect(await authenticate('user', '2')).toBeNull();
  });

  test('deleteManagedAccount guards self-deletion and active bookings', async () => {
    await expect(deleteManagedAccount('admin', 'admin')).rejects.toThrow('Không thể xóa tài khoản đang đăng nhập.');
    await expect(deleteManagedAccount('ghost', 'admin')).rejects.toThrow('Không tìm thấy tài khoản.');

    await seedBookings([makeBooking({ requesterUsername: 'user', status: 'APPROVED' })]);
    await expect(deleteManagedAccount('user', 'admin'))
      .rejects.toThrow('Tài khoản còn yêu cầu đặt phòng đang hoạt động. Hãy xử lý trước khi xóa.');

    await seedBookings([makeBooking({ requesterUsername: 'user', status: 'CANCELLED' })]);
    await deleteManagedAccount('user', 'admin');
    expect((await getAccounts()).map(item => item.username)).toEqual(['admin']);
  });
});

describe('mật khẩu', () => {
  test('resetPasswordWithRecoveryCode', async () => {
    await expect(resetPasswordWithRecoveryCode('user', '222222', '12')).rejects.toThrow('Mật khẩu mới cần ít nhất 4 ký tự.');
    await expect(resetPasswordWithRecoveryCode('user', 'wrong', 'abcd')).rejects.toThrow('Tài khoản hoặc mã khôi phục không đúng.');
    await expect(resetPasswordWithRecoveryCode('ghost', '222222', 'abcd')).rejects.toThrow('Tài khoản hoặc mã khôi phục không đúng.');
    await resetPasswordWithRecoveryCode(' USER ', '222222', 'abcd');
    expect(await authenticate('user', 'abcd')).not.toBeNull();
  });

  test('changePassword', async () => {
    await expect(changePassword('user', '2', 'abc')).rejects.toThrow('Mật khẩu mới cần ít nhất 4 ký tự.');
    await expect(changePassword('user', 'wrong', 'abcd')).rejects.toThrow('Mật khẩu hiện tại không đúng.');
    await changePassword('user', '2', 'abcd');
    expect(await authenticate('user', 'abcd')).not.toBeNull();
  });
});
