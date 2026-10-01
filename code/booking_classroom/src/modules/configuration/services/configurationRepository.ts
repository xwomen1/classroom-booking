import { apiRequest, isRemoteApiEnabled } from '../../../core/api/client';
import { readJson, writeJson } from '../../../core/storage/jsonStorage';
import { DEFAULT_CONFIGURATION, type AppConfiguration } from '../model/appConfiguration';
import { assertAccountRole } from '../../auth/services/accountRepository';

const CONFIGURATION_KEY = 'configuration.app';

export async function getConfiguration(): Promise<AppConfiguration> {
  if (isRemoteApiEnabled()) {
    return apiRequest<AppConfiguration>('/api/configuration');
  }
  const stored = await readJson<Partial<AppConfiguration> | null>(CONFIGURATION_KEY, null);
  return { ...DEFAULT_CONFIGURATION, ...(stored ?? {}) };
}

export async function saveConfiguration(input: AppConfiguration, adminUsername: string): Promise<AppConfiguration> {
  await assertAccountRole(adminUsername, 'admin');
  const values = [
    input.minAdvanceDays, input.maxAdvanceDays, input.maxActiveBookingsPerUser,
    input.cancellationCutoffMinutes, input.roomChangeCutoffMinutes, input.pinGraceMinutes,
    input.noShowGraceMinutes,
  ];
  if (values.some(value => !Number.isInteger(value) || value < 0)) {
    throw new Error('Các tham số cấu hình phải là số nguyên không âm.');
  }
  if (input.minAdvanceDays > input.maxAdvanceDays) {
    throw new Error('Số ngày đặt tối thiểu không được lớn hơn tối đa.');
  }
  if (input.maxActiveBookingsPerUser < 1) {
    throw new Error('Mỗi người phải được phép có ít nhất một yêu cầu đang hoạt động.');
  }
  await writeJson(CONFIGURATION_KEY, input);
  return input;
}
