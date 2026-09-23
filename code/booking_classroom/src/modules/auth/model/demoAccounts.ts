import type { UserRole } from '../../../core/types/userRole';

export type DemoAccount = {
  username: string;
  password: string;
  role: UserRole;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { username: 'admin', password: '1', role: 'admin' },
  { username: 'user', password: '2', role: 'user' },
];
