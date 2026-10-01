import { storage, writeJson } from '../src/core/storage/jsonStorage';
import {
  acceptKeyPickupProposal,
  createBooking,
  getBookingById,
  proposeKeyPickup,
  reviewBooking,
  type Booking,
} from '../src/modules/booking';
import {
  getMaintenanceRequests,
  requestRoomMaintenance,
  scheduleMaintenanceFromRequest,
} from '../src/modules/schedule_maintenance';
import { parseSmartLockAccessEvent } from '../src/modules/smart_lock';

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

describe('phase 2 local workflows', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  test('lets the current room user report maintenance and lets admin schedule it', async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 20 * 60_000);
    const end = new Date(now.getTime() + 40 * 60_000);
    const booking: Booking = {
      id: 'booking-current-maintenance',
      requesterUsername: 'user',
      roomId: 'room-a101',
      date: formatLocalDate(now),
      startTime: formatTime(start),
      endTime: formatTime(end),
      purpose: 'Dạy học',
      status: 'APPROVED',
      createdAt: now.toISOString(),
    };
    await writeJson('booking.records', [booking]);

    const request = await requestRoomMaintenance(
      booking.id,
      'user',
      'Máy chiếu không hoạt động',
      now,
    );
    expect(request.status).toBe('PENDING');
    await expect(
      requestRoomMaintenance(booking.id, 'user', 'Yêu cầu trùng', now),
    ).rejects.toThrow('đang chờ xử lý');

    await scheduleMaintenanceFromRequest(request.id, {
      roomId: booking.roomId,
      date: dateAfter(1),
      startTime: '12:00',
      endTime: '13:00',
      reason: request.reason,
      createdBy: 'admin',
    });
    await expect(getMaintenanceRequests()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: request.id, status: 'SCHEDULED' })]),
    );
  });

  test('negotiates physical-key pickup until both sides agree', async () => {
    const date = dateAfter(1);
    const booking = await createBooking({
      requesterUsername: 'user',
      roomId: 'room-b202',
      date,
      startTime: '16:00',
      endTime: '17:00',
      purpose: 'Giảng bài',
    });
    await reviewBooking(booking.id, 'APPROVED', 'admin');
    const requested = await proposeKeyPickup(booking.id, 'user', 'user', date, '14:00');
    expect(requested.keyPickupNegotiation?.status).toBe('WAITING_ADMIN');
    const countered = await proposeKeyPickup(
      booking.id,
      'admin',
      'admin',
      date,
      '14:30',
      'Phòng trực A1',
    );
    expect(countered.keyPickupNegotiation?.status).toBe('WAITING_USER');
    const agreed = await acceptKeyPickupProposal(booking.id, 'user', 'user');
    expect(agreed.keyPickupAppointment).toMatchObject({
      date,
      time: '14:30',
      location: 'Phòng trực A1',
    });
    expect((await getBookingById(booking.id))?.keyPickupNegotiation?.status).toBe('AGREED');
  });

  test('parses Tools-style SmartLock check-in and future checkout traits', () => {
    const checkInPayload = JSON.stringify({
      pc: {
        'm2m:cin': {
          con: JSON.stringify({
            typeMessage: 'updateData',
            dataMessage: {
              properties: {
                command: 'updateTrait',
                data: {
                  deviceID: 'smart-lock-device',
                  trait: 'traitUnlockMCU',
                  timeStamp: 1_800_000_000,
                },
              },
            },
          }),
        },
      },
    });
    expect(parseSmartLockAccessEvent(checkInPayload)).toMatchObject({
      type: 'CHECK_IN',
      trait: 'traitUnlockMCU',
      deviceId: 'smart-lock-device',
    });
    const simulatorPayload = (trait: string, value: number) => JSON.stringify({
      pc: {
        'm2m:cin': {
          con: JSON.stringify({
            dataMessage: {
              properties: {
                data: { deviceID: 'smart-lock-device', trait, value },
              },
            },
          }),
        },
      },
    });
    expect(parseSmartLockAccessEvent(simulatorPayload('traitUnlockTempPwd', 7))).toMatchObject({
      type: 'CHECK_IN',
      trait: 'traitUnlockTempPwd',
    });
    expect(parseSmartLockAccessEvent(simulatorPayload('traitLocked', 2))).toMatchObject({
      type: 'CHECK_OUT',
      trait: 'traitLocked',
    });
    expect(parseSmartLockAccessEvent(simulatorPayload('traitResponseUnlockStatus', 1))).toBeUndefined();
    expect(parseSmartLockAccessEvent(simulatorPayload('traitResponseUnlockStatus', 0))).toMatchObject({
      type: 'CHECK_IN',
    });
    expect(parseSmartLockAccessEvent(JSON.stringify({ event: 'checkout' }))).toMatchObject({
      type: 'CHECK_OUT',
      trait: 'checkout',
    });
  });
});
