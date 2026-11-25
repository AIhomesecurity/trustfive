export type BookingReviewDraft = {stars: string; body: string};
export type BookingReviewDrafts = ReadonlyMap<string, BookingReviewDraft>;

const emptyDraft: BookingReviewDraft = {stars: '5', body: ''};

export function bookingReviewDraft(drafts: BookingReviewDrafts, bookingId: string): BookingReviewDraft {
  return drafts.get(bookingId) ?? emptyDraft;
}

export function updateBookingReviewDraft(
  drafts: BookingReviewDrafts,
  bookingId: string,
  changes: Partial<BookingReviewDraft> | null
): BookingReviewDrafts {
  const updated = new Map(drafts);
  if (changes) updated.set(bookingId, {...bookingReviewDraft(drafts, bookingId), ...changes});
  else updated.delete(bookingId);
  return updated;
}
