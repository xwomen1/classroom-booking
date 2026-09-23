import type { UserRole } from './userRole';

export type AuthenticatedUser = {
  username: string;
  role: UserRole;
};
