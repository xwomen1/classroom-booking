/* eslint-env jest */
import {
  DEFAULT_CONFIGURATION,
  getConfiguration,
  saveConfiguration,
  type AppConfiguration,
} from '../../src/modules/configuration';
import { getProfile, saveProfile } from '../../src/modules/profile';
import { writeJson } from '../../src/core/storage/jsonStorage';
import { resetStorage } from '../support/testUtils';

beforeEach(async () => {
  await resetStorage();
});

describe('configurationRepository', () => {
  test('returns the defaults when nothing is stored', async () => {
    expect(await getConfiguration()).toEqual(DEFAULT_CONFIGURATION);
  });

  test('merges partially stored values with the defaults', async () => {
    await writeJson('configuration.app', { maxAdvanceDays: 7 });
    expect(await getConfiguration()).toEqual({ ...DEFAULT_CONFIGURATION, maxAdvanceDays: 7 });
  });

  test('only an admin can save', async () => {
    await expect(saveConfiguration(DEFAULT_CONFIGURATION, 'user')).rejects.toThrow('Bạn không có quyền thực hiện thao tác này.');
  });

  const numericFields: Array<keyof Omit<AppConfiguration, 'notificationsEnabled'>> = [
    'minAdvanceDays', 'maxAdvanceDays', 'maxActiveBookingsPerUser', 'cancellationCutoffMinutes',
    'roomChangeCutoffMinutes', 'pinGraceMinutes', 'noShowGraceMinutes',
  ];

  test.each(numericFields.flatMap(field => [[field, -1], [field, 1.5], [field, Number.NaN]]))(
    'rejects %s=%s',
    async (field, value) => {
      await expect(saveConfiguration({ ...DEFAULT_CONFIGURATION, maxAdvanceDays: 10, [field]: value }, 'admin'))
        .rejects.toThrow('Các tham số cấu hình phải là số nguyên không âm.');
    },
  );

  test('rejects min > max and a zero active-booking limit', async () => {
    await expect(saveConfiguration({ ...DEFAULT_CONFIGURATION, minAdvanceDays: 4, maxAdvanceDays: 3 }, 'admin'))
      .rejects.toThrow('Số ngày đặt tối thiểu không được lớn hơn tối đa.');
    await expect(saveConfiguration({ ...DEFAULT_CONFIGURATION, maxActiveBookingsPerUser: 0 }, 'admin'))
      .rejects.toThrow('Mỗi người phải được phép có ít nhất một yêu cầu đang hoạt động.');
  });

  test('accepts zero grace periods and persists the result', async () => {
    const next = { ...DEFAULT_CONFIGURATION, minAdvanceDays: 0, pinGraceMinutes: 0, notificationsEnabled: false };
    await saveConfiguration(next, 'admin');
    expect(await getConfiguration()).toEqual(next);
  });
});

describe('profileRepository', () => {
  test('provides role-aware defaults', async () => {
    expect((await getProfile('admin')).fullName).toBe('Cán bộ quản lý cơ sở vật chất');
    expect((await getProfile('user')).fullName).toBe('Giảng viên');
    expect(await getProfile('someone')).toEqual({ username: 'someone', fullName: '', email: '', phone: '', department: '' });
  });

  test('saves profiles per user', async () => {
    await saveProfile({ username: 'user', fullName: 'Nguyễn A', email: 'a@x.vn', phone: '09', department: 'CNTT' });
    expect((await getProfile('user')).fullName).toBe('Nguyễn A');
    expect((await getProfile('admin')).fullName).toBe('Cán bộ quản lý cơ sở vật chất');
  });
});
