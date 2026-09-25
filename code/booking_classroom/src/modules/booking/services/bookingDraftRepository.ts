import { readJson, writeJson } from '../../../core/storage/jsonStorage';

export type BookingDraftSelection = {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  markedAt: string;
};

function key(username: string) {
  return `booking.draft.${username}`;
}

export async function getBookingDraftSelection(username: string): Promise<BookingDraftSelection | null> {
  return readJson<BookingDraftSelection | null>(key(username), null);
}

export async function saveBookingDraftSelection(
  username: string,
  input: Omit<BookingDraftSelection, 'markedAt'>,
): Promise<BookingDraftSelection> {
  const selection = { ...input, markedAt: new Date().toISOString() };
  await writeJson(key(username), selection);
  return selection;
}
