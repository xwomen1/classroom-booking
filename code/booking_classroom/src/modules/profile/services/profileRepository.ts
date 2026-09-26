import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import type { UserProfile } from '../model/userProfile';

const PROFILE_KEY_PREFIX = 'profile.';

function createDefaultProfile(username: string): UserProfile {
  return {
    username,
    fullName:
      username === 'admin'
        ? 'Cán bộ quản lý cơ sở vật chất'
        : username === 'user'
          ? 'Giảng viên'
          : '',
    email: '',
    phone: '',
    department: '',
  };
}

export async function getProfile(username: string): Promise<UserProfile> {
  return readJson(
    `${PROFILE_KEY_PREFIX}${username}`,
    createDefaultProfile(username),
  );
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await writeJson(`${PROFILE_KEY_PREFIX}${profile.username}`, profile);
}
