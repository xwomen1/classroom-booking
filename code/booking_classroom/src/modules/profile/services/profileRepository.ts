import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { apiRequest, isRemoteApiEnabled } from '../../../core/api/client';
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
  if (isRemoteApiEnabled()) {
    return apiRequest<UserProfile>(`/api/profiles/${encodeURIComponent(username)}`);
  }
  return readJson(
    `${PROFILE_KEY_PREFIX}${username}`,
    createDefaultProfile(username),
  );
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  if (isRemoteApiEnabled()) {
    await apiRequest<UserProfile>(`/api/profiles/${encodeURIComponent(profile.username)}`, {
      method: 'PUT',
      body: profile,
    });
    return;
  }
  await writeJson(`${PROFILE_KEY_PREFIX}${profile.username}`, profile);
}
