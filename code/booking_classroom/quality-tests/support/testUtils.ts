/* eslint-env jest */
/**
 * Tiện ích dùng chung cho bộ kiểm thử chất lượng (quality-tests).
 * Không phụ thuộc vào helper hay cấu hình test có sẵn của dự án.
 */
import ReactTestRenderer from 'react-test-renderer';
import { storage, writeJson } from '../../src/core/storage/jsonStorage';
import type { Booking } from '../../src/modules/booking/model/booking';
import type { AppConfiguration } from '../../src/modules/configuration/model/appConfiguration';
import { DEFAULT_CONFIGURATION } from '../../src/modules/configuration/model/appConfiguration';

/** Mốc thời gian cố định để mọi luật theo ngày/giờ cho kết quả ổn định. */
export const FIXED_NOW = new Date(2030, 0, 10, 8, 0, 0);

export async function resetStorage(): Promise<void> {
  await storage.clear();
}

export function freezeTime(now: Date = FIXED_NOW): void {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(now);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Ngày lịch cách `from` một số ngày, theo giờ địa phương. */
export function dayOffset(days: number, from: Date = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

let bookingSequence = 0;

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  bookingSequence += 1;
  return {
    id: `test-booking-${bookingSequence}`,
    requesterUsername: 'user',
    roomId: 'room-a101',
    date: dayOffset(1, FIXED_NOW),
    startTime: '09:00',
    endTime: '10:00',
    purpose: 'Kiểm thử',
    status: 'PENDING',
    createdAt: FIXED_NOW.toISOString(),
    ...overrides,
  };
}

export async function seedBookings(bookings: Booking[]): Promise<void> {
  await writeJson('booking.records', bookings);
}

export async function seedConfiguration(changes: Partial<AppConfiguration>): Promise<void> {
  await writeJson('configuration.app', { ...DEFAULT_CONFIGURATION, ...changes });
}

/* ---------- Tiện ích cho kiểm thử giao diện ---------- */

type Instance = ReactTestRenderer.ReactTestInstance;

export function textContent(node: Instance): string {
  return node.children
    .map(item => (typeof item === 'string' ? item : textContent(item)))
    .join('');
}

export function findPressable(root: Instance, label: string): Instance {
  const matches = root
    .findAll(item => typeof item.props.onPress === 'function')
    .filter(item => textContent(item).includes(label));
  if (matches.length === 0) throw new Error(`Không tìm thấy nút "${label}".`);
  // Phần tử sâu nhất là nút thật; các phần tử cha chỉ bọc lại onPress.
  return matches[matches.length - 1];
}

export function findInputByTestId(root: Instance, testID: string): Instance {
  const input = root
    .findAll(item => item.props.testID === testID && typeof item.props.onChangeText === 'function');
  if (input.length === 0) throw new Error(`Không tìm thấy ô nhập "${testID}".`);
  return input[0];
}

/** Ô nhập đứng ngay sau nhãn `label` trong cây giao diện. */
export function findInputByLabel(root: Instance, label: string): Instance {
  const inputs = root.findAll(item => typeof item.props.onChangeText === 'function' && typeof item.type !== 'string');
  const labelled = inputs.find(input => {
    const field = input.parent?.parent ?? input.parent;
    return field ? textContent(field).startsWith(label) : false;
  });
  if (!labelled) throw new Error(`Không tìm thấy ô nhập có nhãn "${label}".`);
  return labelled;
}

export async function flush(): Promise<void> {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
  });
}

export async function render(element: React.ReactElement): Promise<ReactTestRenderer.ReactTestRenderer> {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  await flush();
  return renderer;
}

export async function press(root: Instance, label: string): Promise<void> {
  await ReactTestRenderer.act(async () => {
    await findPressable(root, label).props.onPress();
  });
  await flush();
}

export async function typeInto(input: Instance, value: string): Promise<void> {
  await ReactTestRenderer.act(async () => {
    input.props.onChangeText(value);
  });
}

export async function unmount(renderer: ReactTestRenderer.ReactTestRenderer): Promise<void> {
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
}
