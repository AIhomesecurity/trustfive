export type ContactPreference =
  | 'in_app_messages'
  | 'phone_after_booking'
  | 'either_after_booking';

export const CONTACT_PREFERENCE_OPTIONS: {
  value: ContactPreference;
  label: string;
  hint: string;
}[] = [
  {
    value: 'in_app_messages',
    label: 'TrustFive messages only',
    hint: 'Keep all pre-booking and booking messages inside your account.',
  },
  {
    value: 'phone_after_booking',
    label: 'Phone call after booking is confirmed',
    hint: 'Your phone number is never shown in public job leads.',
  },
  {
    value: 'either_after_booking',
    label: 'Messages or phone after booking is confirmed',
    hint: 'Start in TrustFive messages; switch to phone only once booked.',
  },
];

export function readableContactPreference(value: string | null | undefined): string {
  const match = CONTACT_PREFERENCE_OPTIONS.find(item => item.value === value);
  return match ? match.label : 'TrustFive messages only';
}

export type ComparableQuote = {
  quote_id: string;
  job_id: string;
  business_name: string;
  amount_pence: number;
  message: string;
  availability_note?: string | null;
  status: string;
  created_at?: string;
};

export type QuoteSortMode = 'lowest_price' | 'newest';

export function sortCustomerQuotes<T extends ComparableQuote>(
  quotes: T[],
  mode: QuoteSortMode
): T[] {
  const copy = [...quotes];
  if (mode === 'lowest_price') {
    copy.sort((a, b) => {
      if (a.amount_pence !== b.amount_pence) return a.amount_pence - b.amount_pence;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return copy;
  }
  copy.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return copy;
}

export function summarizeJobQuotes(quotes: ComparableQuote[]): {
  total: number;
  pending: number;
  lowestPence: number | null;
  highestPence: number | null;
} {
  if (!quotes.length) {
    return {total: 0, pending: 0, lowestPence: null, highestPence: null};
  }
  const active = quotes.filter(q => q.status !== 'withdrawn');
  const pool = active.length ? active : quotes;
  let lowest = pool[0].amount_pence;
  let highest = pool[0].amount_pence;
  for (const item of pool) {
    if (item.amount_pence < lowest) lowest = item.amount_pence;
    if (item.amount_pence > highest) highest = item.amount_pence;
  }
  return {
    total: quotes.length,
    pending: quotes.filter(q => q.status === 'pending').length,
    lowestPence: lowest,
    highestPence: highest,
  };
}

export function validateQuoteAvailability(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (clean.length < 3 || clean.length > 240) {
    return 'Availability summary must be between 3 and 240 characters (or left blank).';
  }
  return null;
}

export type BookingTimelineStep = {
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'cancelled';
};

export function deriveBookingProgressSteps(
  bookingStatus: string,
  appointmentStatus?: string | null
): BookingTimelineStep[] {
  if (bookingStatus === 'cancelled') {
    return [
      {label: 'Quote accepted', state: 'done'},
      {label: 'Appointment agreed', state: 'cancelled'},
      {label: 'Work marked ready', state: 'cancelled'},
      {label: 'Customer confirmed', state: 'cancelled'},
    ];
  }
  const apptDone = appointmentStatus === 'confirmed';
  const workReady = bookingStatus === 'awaiting_customer' || bookingStatus === 'completed';
  const completed = bookingStatus === 'completed';

  return [
    {label: 'Quote accepted', state: 'done'},
    {
      label: apptDone
        ? 'Appointment confirmed'
        : appointmentStatus === 'proposed'
          ? 'Appointment proposed'
          : 'Agree appointment',
      state: apptDone || workReady ? 'done' : 'current',
    },
    {
      label: 'Work marked ready',
      state: workReady ? 'done' : apptDone ? 'current' : 'upcoming',
    },
    {
      label: 'Customer confirmed',
      state: completed ? 'done' : workReady ? 'current' : 'upcoming',
    },
  ];
}
