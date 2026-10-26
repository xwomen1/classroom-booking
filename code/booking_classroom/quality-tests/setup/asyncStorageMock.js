/* eslint-env jest */
/**
 * Async Storage chạy trong bộ nhớ cho bộ kiểm thử chất lượng.
 * Mọi instance tạo bằng createAsyncStorage() dùng chung một kho, giống app
 * thật chỉ dùng một namespace; resetStorage() trong support/testUtils xóa kho.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  const api = {
    getItem: async key => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => {
      store.set(key, String(value));
    },
    removeItem: async key => {
      store.delete(key);
    },
    clear: async () => {
      store.clear();
    },
    getAllKeys: async () => [...store.keys()],
    multiGet: async keys => keys.map(key => [key, store.has(key) ? store.get(key) : null]),
    multiSet: async pairs => {
      for (const [key, value] of pairs) store.set(key, String(value));
    },
    multiRemove: async keys => {
      for (const key of keys) store.delete(key);
    },
  };
  return { __esModule: true, default: api, createAsyncStorage: () => api };
});
