import { authenticate } from '../src/modules/auth';

describe('local demo authentication', () => {
  test('routes admin/1 to admin mode', () => {
    expect(authenticate('admin', '1')).toBe('admin');
  });

  test('routes user/2 to user mode', () => {
    expect(authenticate('user', '2')).toBe('user');
  });

  test('rejects an invalid credential pair', () => {
    expect(authenticate('admin', '2')).toBeNull();
    expect(authenticate('unknown', '1')).toBeNull();
  });
});
