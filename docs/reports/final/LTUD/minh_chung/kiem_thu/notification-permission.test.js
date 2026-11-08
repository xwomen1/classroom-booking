/* eslint-env jest */
const path = require('path');
const mockPlatform = { OS: 'android', Version: 33 };
const mockCheck = jest.fn();
const mockRequest = jest.fn();
const mockShow = jest.fn();
jest.mock('react-native', () => ({
  Platform: mockPlatform,
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    check: (...args) => mockCheck(...args),
    request: (...args) => mockRequest(...args),
  },
  NativeModules: { PriorityNotification: { show: (...args) => mockShow(...args) } },
}));

const appRoot = process.env.ROOMHUB_APP_ROOT || path.resolve(__dirname, '../../../../../../code/booking_classroom');
const service = require(path.join(appRoot, 'src/modules/notifications/services/priorityBanner'));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'android';
  mockPlatform.Version = 33;
  mockCheck.mockResolvedValue(false);
  mockRequest.mockResolvedValue('denied');
  mockShow.mockResolvedValue(true);
});

test('Android 12 does not request the Android 13 runtime permission', async () => {
  mockPlatform.Version = 31;
  await expect(service.requestPriorityNotificationPermission()).resolves.toBeUndefined();
  expect(mockCheck).not.toHaveBeenCalled();
  expect(mockRequest).not.toHaveBeenCalled();
});

test('denying Android 13 permission resolves without throwing', async () => {
  await expect(service.requestPriorityNotificationPermission()).resolves.toBeUndefined();
  expect(mockRequest).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
});

test('denied permission suppresses native notification while preserving in-app banner', async () => {
  const received = [];
  const unsubscribe = service.subscribePriorityBanners(banner => received.push(banner));
  try {
    await expect(service.presentPriorityNotification('Test', 'QA0811', 'neutral')).resolves.toBeUndefined();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({title: 'Test', message: 'QA0811'});
    expect(mockShow).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});

test('granted permission avoids a second prompt and allows native delivery', async () => {
  mockCheck.mockResolvedValue(true);
  await service.requestPriorityNotificationPermission();
  expect(mockRequest).not.toHaveBeenCalled();
  await service.presentPriorityNotification('Test', 'QA0811', 'neutral');
  expect(mockShow).toHaveBeenCalledWith('Test', 'QA0811', '', 'neutral');
});

test('iOS keeps in-app banner without calling Android permission or native bridge', async () => {
  mockPlatform.OS = 'ios';
  await service.requestPriorityNotificationPermission();
  await service.presentPriorityNotification('Test', 'QA0811', 'neutral');
  expect(mockCheck).not.toHaveBeenCalled();
  expect(mockRequest).not.toHaveBeenCalled();
  expect(mockShow).not.toHaveBeenCalled();
});
