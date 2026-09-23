import type { UserRole } from '../../../core/types/userRole';
import { DEMO_ACCOUNTS } from '../model/demoAccounts';

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
