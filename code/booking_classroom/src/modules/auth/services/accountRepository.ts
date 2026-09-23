import type { AuthenticatedUser } from '../../../core/types/authenticatedUser';
import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { DEMO_ACCOUNTS, type AccountRecord } from '../model/demoAccounts';

const ACCOUNTS_KEY = 'auth.accounts';

async function getAccounts(): Promise<AccountRecord[]> {
  const stored = await readJson<AccountRecord[] | null>(ACCOUNTS_KEY, null);
  if (stored) {
    return stored;
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
    item => item.username === normalizedUsername && item.password === password,
  );

  return account ? { username: account.username, role: account.role } : null;
}

export type RegisterInput = {
  username: string;
  password: string;
};

export async function registerAccount({
  username,
  password,
}: RegisterInput): Promise<AuthenticatedUser> {
  const normalizedUsername = username.trim().toLowerCase();
  const accounts = await getAccounts();

  if (accounts.some(account => account.username === normalizedUsername)) {
    throw new Error('Tên đăng nhập đã tồn tại.');
  }

  const newAccount: AccountRecord = {
    username: normalizedUsername,
    password,
    role: 'user',
  };
  await writeJson(ACCOUNTS_KEY, [...accounts, newAccount]);
  return { username: newAccount.username, role: newAccount.role };
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
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
