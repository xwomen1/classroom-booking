import type { AuthenticatedUser } from '../../../core/types/authenticatedUser';

export type AccountRecord = AuthenticatedUser & {
  password: string;
  recoveryCode?: string;
  active?: boolean;
  createdAt?: string;
};

export const DEMO_ACCOUNTS: readonly AccountRecord[] = [
  { username: 'admin', password: '1', recoveryCode: '111111', role: 'admin', active: true },
  { username: 'user', password: '2', recoveryCode: '222222', role: 'user', active: true },
];
