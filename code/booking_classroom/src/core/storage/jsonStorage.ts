import { createAsyncStorage } from '@react-native-async-storage/async-storage';

const storage = createAsyncStorage('bookingClassroom');

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const value = await storage.getItem(key);
  return value === null ? fallback : (JSON.parse(value) as T);
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await storage.setItem(key, JSON.stringify(value));
}

export { storage };
