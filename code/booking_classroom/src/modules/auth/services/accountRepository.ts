import type { AuthenticatedUser } from '../../../core/types/authenticatedUser';
import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { DEMO_ACCOUNTS, type AccountRecord } from '../model/demoAccounts';

const ACCOUNTS_KEY = 'auth.accounts';

export async function getAccounts(): Promise<AccountRecord[]> {
  const stored = await readJson<AccountRecord[] | null>(ACCOUNTS_KEY, null);
  if (stored) {
    return stored.map(account => ({
      ...account,
      active: account.active ?? true,
      recoveryCode:
        account.recoveryCode ??
        (account.username === 'admin'
          ? '111111'
          : account.username === 'user'
            ? '222222'
            : '000000'),
    }));
  }

  const initialAccounts = DEMO_ACCOUNTS.map(account => ({ ...account }));
  await writeJson(ACCOUNTS_KEY, initialAccounts);
  return initialAccounts;
}

export async function authenticate(
  username: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const accounts = await getAccounts();

  const account = accounts.find(
    item => item.username === normalizedUsername && item.password === password && item.active !== false,
  );

  return account ? { username: account.username, role: account.role } : null;
}

export async function assertAccountRole(username: string, role: AccountRecord['role']): Promise<void> {
  const account = (await getAccounts()).find(item => item.username === username);
  if (!account || account.active === false || account.role !== role) {
    throw new Error(role === 'admin' ? 'Bạn không có quyền thực hiện thao tác này.' : 'Tài khoản không hoạt động hoặc không có quyền thực hiện thao tác này.');
  }
}

export type RegisterInput = {
  username: string;
  password: string;
  recoveryCode?: string;
};

export async function registerAccount({
  username,
  password,
  recoveryCode,
}: RegisterInput): Promise<AuthenticatedUser> {
  const normalizedUsername = username.trim().toLowerCase();
  const accounts = await getAccounts();

  if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
    throw new Error('Tên đăng nhập cần 3–30 ký tự: chữ thường, số, dấu chấm, gạch ngang.');
  }
  if (password.length < 4) {
    throw new Error('Mật khẩu cần ít nhất 4 ký tự.');
  }
  if (recoveryCode !== undefined && recoveryCode.length < 4) {
    throw new Error('Mã khôi phục cần ít nhất 4 ký tự.');
  }

  if (accounts.some(account => account.username === normalizedUsername)) {
    throw new Error('Tên đăng nhập đã tồn tại.');
  }

  const newAccount: AccountRecord = {
    username: normalizedUsername,
    password,
    recoveryCode: recoveryCode || '000000',
    role: 'user',
    active: true,
    createdAt: new Date().toISOString(),
  };
  await writeJson(ACCOUNTS_KEY, [...accounts, newAccount]);
  return { username: newAccount.username, role: newAccount.role };
}

export async function createManagedAccount(input: {
  username: string;
  password: string;
  recoveryCode: string;
  role: AccountRecord['role'];
}, actorUsername: string): Promise<AccountRecord> {
  await assertAccountRole(actorUsername, 'admin');
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new Error('Tên đăng nhập cần 3–30 ký tự: chữ thường, số, dấu chấm, gạch ngang.');
  }
  if (input.password.length < 4 || input.recoveryCode.length < 4) {
    throw new Error('Mật khẩu và mã khôi phục cần ít nhất 4 ký tự.');
  }
  const accounts = await getAccounts();
  if (accounts.some(account => account.username === username)) {
    throw new Error('Tên đăng nhập đã tồn tại.');
  }
  const account: AccountRecord = {
    username,
    password: input.password,
    recoveryCode: input.recoveryCode,
    role: input.role,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await writeJson(ACCOUNTS_KEY, [...accounts, account]);
  return account;
}

export async function updateManagedAccount(
  username: string,
  changes: Partial<Pick<AccountRecord, 'role' | 'active' | 'password' | 'recoveryCode'>>,
  actorUsername: string,
): Promise<AccountRecord> {
  await assertAccountRole(actorUsername, 'admin');
  const accounts = await getAccounts();
  const index = accounts.findIndex(account => account.username === username);
  if (index < 0) throw new Error('Không tìm thấy tài khoản.');
  if (username === actorUsername && (changes.active === false || changes.role === 'user')) {
    throw new Error('Không thể tự khóa hoặc thay đổi quyền của tài khoản đang đăng nhập.');
  }
  if (changes.password !== undefined && changes.password.length < 4) {
    throw new Error('Mật khẩu cần ít nhất 4 ký tự.');
  }
  if (changes.recoveryCode !== undefined && changes.recoveryCode.length < 4) {
    throw new Error('Mã khôi phục cần ít nhất 4 ký tự.');
  }
  const updated = { ...accounts[index], ...changes };
  const next = [...accounts];
  next[index] = updated;
  await writeJson(ACCOUNTS_KEY, next);
  return updated;
}

export async function deleteManagedAccount(username: string, actorUsername: string): Promise<void> {
  await assertAccountRole(actorUsername, 'admin');
  if (username === actorUsername) throw new Error('Không thể xóa tài khoản đang đăng nhập.');
  const accounts = await getAccounts();
  const target = accounts.find(account => account.username === username);
  if (!target) throw new Error('Không tìm thấy tài khoản.');
  const bookings = await readJson<Array<{ requesterUsername: string; status: string }>>('booking.records', []);
  if (bookings.some(item => item.requesterUsername === username && ['PENDING', 'APPROVED'].includes(item.status))) {
    throw new Error('Tài khoản còn yêu cầu đặt phòng đang hoạt động. Hãy xử lý trước khi xóa.');
  }
  await writeJson(ACCOUNTS_KEY, accounts.filter(account => account.username !== username));
}

export async function resetPasswordWithRecoveryCode(
  username: string,
  recoveryCode: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 4) throw new Error('Mật khẩu mới cần ít nhất 4 ký tự.');
  const accounts = await getAccounts();
  const index = accounts.findIndex(account => account.username === username.trim().toLowerCase());
  if (index < 0 || accounts[index].recoveryCode !== recoveryCode) {
    throw new Error('Tài khoản hoặc mã khôi phục không đúng.');
  }
  const next = [...accounts];
  next[index] = { ...next[index], password: newPassword };
  await writeJson(ACCOUNTS_KEY, next);
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 4) {
    throw new Error('Mật khẩu mới cần ít nhất 4 ký tự.');
  }
  const accounts = await getAccounts();
  const accountIndex = accounts.findIndex(item => item.username === username);

  if (accountIndex < 0 || accounts[accountIndex].password !== currentPassword) {
    throw new Error('Mật khẩu hiện tại không đúng.');
  }

  const updatedAccounts = [...accounts];
  updatedAccounts[accountIndex] = {
    ...updatedAccounts[accountIndex],
    password: newPassword,
  };
  await writeJson(ACCOUNTS_KEY, updatedAccounts);
}
