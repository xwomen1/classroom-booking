import { storage } from '../src/core/storage/jsonStorage';
import {
  authenticate,
  changePassword,
  registerAccount,
  resetPasswordWithRecoveryCode,
} from '../src/modules/auth';

describe('local account authentication', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  test('routes the two demo accounts to their correct modes', async () => {
    await expect(authenticate('admin', '1')).resolves.toEqual({
      username: 'admin',
      role: 'admin',
    });
    await expect(authenticate('user', '2')).resolves.toEqual({
      username: 'user',
      role: 'user',
    });
  });

  test('registers a new user and persists its credential', async () => {
    await registerAccount({ username: 'teacher01', password: '1234' });

    await expect(authenticate('teacher01', '1234')).resolves.toEqual({
      username: 'teacher01',
      role: 'user',
    });
  });

  test('changes a password and invalidates the previous password', async () => {
    await changePassword('user', '2', '2468');

    await expect(authenticate('user', '2')).resolves.toBeNull();
    await expect(authenticate('user', '2468')).resolves.toEqual({
      username: 'user',
      role: 'user',
    });
  });

  test('rejects invalid credentials and duplicate usernames', async () => {
    await expect(authenticate('admin', '2')).resolves.toBeNull();
    await expect(
      registerAccount({ username: 'admin', password: '9999' }),
    ).rejects.toThrow('Tên đăng nhập đã tồn tại.');
  });

  test('adds recovery codes to demo accounts created by an older app version', async () => {
    await storage.setItem(
      'auth.accounts',
      JSON.stringify([
        { username: 'admin', password: '1', role: 'admin' },
        { username: 'user', password: '2', role: 'user' },
      ]),
    );
    await resetPasswordWithRecoveryCode('user', '222222', '2468');
    await expect(authenticate('user', '2468')).resolves.toEqual({
      username: 'user',
      role: 'user',
    });
  });
});
