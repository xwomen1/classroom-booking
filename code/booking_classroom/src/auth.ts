export type UserRole = 'admin' | 'user';

type DemoAccount = {
  username: string;
  password: string;
  role: UserRole;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { username: 'admin', password: '1', role: 'admin' },
  { username: 'user', password: '2', role: 'user' },
];

export function authenticate(
  username: string,
  password: string,
): UserRole | null {
  const normalizedUsername = username.trim().toLowerCase();
  const account = DEMO_ACCOUNTS.find(
    item => item.username === normalizedUsername && item.password === password,
  );

  return account?.role ?? null;
}
