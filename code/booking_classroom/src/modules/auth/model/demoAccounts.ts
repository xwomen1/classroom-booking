import type { AuthenticatedUser } from '../../../core/types/authenticatedUser';

export type AccountRecord = AuthenticatedUser & {
  password: string;
};

export const DEMO_ACCOUNTS: readonly AccountRecord[] = [
  { username: 'admin', password: '1', role: 'admin' },
  { username: 'user', password: '2', role: 'user' },
];
