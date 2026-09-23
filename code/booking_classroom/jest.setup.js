/* global jest */

const mockStorageData = new Map();

const mockStorage = {
  getItem: jest.fn(async key => mockStorageData.get(key) ?? null),
  setItem: jest.fn(async (key, value) => {
    mockStorageData.set(key, value);
  }),
  removeItem: jest.fn(async key => {
    mockStorageData.delete(key);
  }),
  clear: jest.fn(async () => {
    mockStorageData.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(mockStorageData.keys())),
  multiGet: jest.fn(async keys =>
    keys.map(key => [key, mockStorageData.get(key) ?? null]),
  ),
  multiSet: jest.fn(async entries => {
    entries.forEach(([key, value]) => mockStorageData.set(key, value));
  }),
  multiRemove: jest.fn(async keys => {
    keys.forEach(key => mockStorageData.delete(key));
  }),
  mergeItem: jest.fn(),
  multiMerge: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  createAsyncStorage: () => mockStorage,
  default: mockStorage,
}));
