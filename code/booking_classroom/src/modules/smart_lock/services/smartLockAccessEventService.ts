import { recordSmartLockAccessEvent } from '../../booking/services/bookingRepository';
import type { SmartLockAccessEvent } from '../../booking/model/booking';
import {
  subscribeOneIoTSmartLockMessages,
  type OneIoTSmartLockMessage,
} from './oneIoTClient';
import { getManagedSmartLock } from './smartLockRepository';

type JsonObject = Record<string, unknown>;

const CHECK_IN_TRAITS = new Set([
  'traitUnlockMCU',
  'traitUnlockApp',
  'traitUnlockPassword',
  'traitUnlockTempPwd',
  'traitUnlockFinger',
  'traitUnlockCard',
  'traitUnlockInside',
  'traitCheckIn',
]);

const CHECK_OUT_TRAITS = new Set([
  'traitLockMCU',
  'traitLockApp',
  'traitResponseLockStatus',
  'traitDoorClosed',
  'traitLocked',
  'traitCheckOut',
]);

function objectValue(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function unwrapInner(root: JsonObject): JsonObject | undefined {
  const pc = objectValue(root.pc);
  let cin = objectValue(pc?.['m2m:cin']);
  if (!cin) {
    const signal = objectValue(pc?.['m2m:sgn']);
    const event = objectValue(signal?.nev);
    const report = objectValue(event?.rep);
    cin = objectValue(report?.['m2m:cin']);
  }
  let current: unknown = cin ? parseJson(cin.con) : root;
  for (let index = 0; index < 5; index += 1) {
    const object = objectValue(current);
    if (!object) return undefined;
    const dataMessage = objectValue(object.dataMessage);
    if (dataMessage) return object;
    const nested = parseJson(object.data);
    if (nested === object.data) return object;
    current = nested;
  }
  return objectValue(current);
}

function traitData(inner: JsonObject): JsonObject | undefined {
  const candidates: JsonObject[] = [inner];
  const nested = objectValue(parseJson(inner.data));
  if (nested) candidates.push(nested);
  for (const candidate of candidates) {
    const dataMessage = objectValue(candidate.dataMessage);
    const properties = objectValue(dataMessage?.properties);
    const data = objectValue(properties?.data);
    if (typeof data?.trait === 'string') return data;
    if (typeof candidate.trait === 'string') return candidate;
  }
  return undefined;
}

function normalizeOccurredAt(value: unknown, fallback: string): string {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const numeric = Number(value);
    const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

export function parseSmartLockAccessEvent(
  payload: string,
  receivedAt = new Date().toISOString(),
): Omit<SmartLockAccessEvent, 'topic'> | undefined {
  const root = objectValue(parseJson(payload));
  if (!root) return undefined;
  const inner = unwrapInner(root);
  if (!inner) return undefined;
  const data = traitData(inner);
  const directEvent = String(inner.event ?? data?.event ?? '').trim().toLowerCase();
  const trait = typeof data?.trait === 'string' ? data.trait : '';
  let type: SmartLockAccessEvent['type'] | undefined;
  const responseUnlockSucceeded = trait === 'traitResponseUnlockStatus' &&
    (data?.value === 0 || data?.value === '0');
  if (CHECK_IN_TRAITS.has(trait) || responseUnlockSucceeded ||
      ['checkin', 'check_in', 'check-in'].includes(directEvent)) {
    type = 'CHECK_IN';
  } else if (CHECK_OUT_TRAITS.has(trait) || ['checkout', 'check_out', 'check-out'].includes(directEvent)) {
    type = 'CHECK_OUT';
  }
  if (!type) return undefined;
  const deviceId = data?.deviceID ?? data?.deviceId ?? inner.deviceID ?? inner.deviceId;
  return {
    type,
    trait: trait || directEvent,
    occurredAt: normalizeOccurredAt(data?.timeStamp ?? data?.timestamp ?? inner.timeStamp, receivedAt),
    deviceId: typeof deviceId === 'string' ? deviceId : undefined,
  };
}

export async function handleOneIoTSmartLockMessage(
  message: OneIoTSmartLockMessage,
): Promise<void> {
  const event = parseSmartLockAccessEvent(message.payload, message.receivedAt);
  if (!event) return;
  const lock = await getManagedSmartLock();
  if (!lock.assignedRoomId) return;
  if (event.deviceId && ![lock.smartLockDeviceId, lock.smartLockAeId].includes(event.deviceId)) return;
  await recordSmartLockAccessEvent(lock.assignedRoomId, { ...event, topic: message.topic });
}

export function startSmartLockAccessEventIntegration(): () => void {
  return subscribeOneIoTSmartLockMessages(message => {
    handleOneIoTSmartLockMessage(message).catch(() => {
      // Ignore malformed or unmatched telemetry; the MQTT session must stay alive.
    });
  });
}
