'use client';

import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {bookingReviewDraft, updateBookingReviewDraft, type BookingReviewDrafts} from '../../lib/booking-review-draft';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {loadBookingSiteBatch} from '../../lib/booking-site-batch';
import {resolveLinkedBooking} from '../../lib/booking-lifecycle';
import {canConfirmCompletedBooking} from '../../lib/booking-completion-guard';
import BookingListItem from '../../components/booking-list-item';
import SelectedBookingDetail from '../../components/selected-booking-detail';
import {
  applyCommittedAppointmentMap,
  applyCommittedBookingStatus,
  applyCommittedReview,
  clearBookingSiteCache,
  createSingleFlightLock,
  executeBookingAction,
  filterBookings,
  markBookingSiteNeedsRecheck,
  resolveSelectedBookingId,
  summarizeBookingStatuses,
  validateBookingReviewInput,
  type BookingAppointmentLike,
  type BookingRecordLike,
  type BookingSiteLike,
  type BookingStatusFilter,
} from '../../lib/booking-lifecycle';

type Booking = BookingRecordLike;
type Appointment = BookingAppointmentLike;
type Review = {booking_id: string};
type JobSite = BookingSiteLike;

type BookingEnrichment = {
  jobTitle?: string;
  businessName?: string;
  amountPence?: number;
};

type NoticeTone = 'info' | 'warn' | 'error';
type SectionRetryError = {
  section: 'appointment' | 'address' | 'completion' | 'review';
  message: string;
} | null;

const FILTER_OPTIONS: ReadonlyArray<{key: BookingStatusFilter; label: string}> = [
  {key: 'needs_action', label: 'Needs action'},
  {key: 'active', label: 'Active'},
  {key: 'completed', label: 'Completed'},
  {key: 'all', label: 'All'},
];

export default function Bookings() {
  const [userId, setUserId] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [appointments, setAppointments] = useState<Record<string, Appointment>>({});
  const [enrichments, setEnrichments] = useState<Record<string, BookingEnrichment>>({});
  const [sites, setSites] = useState<Record<string, JobSite | null>>({});
  const [siteUnavailableIds, setSiteUnavailableIds] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>('all');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [deepLinkBookingId, setDeepLinkBookingId] = useState('');
  const [unavailableBooking, setUnavailableBooking] = useState(false);

  const [checkingAccount, setCheckingAccount] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [initialLoadError, setInitialLoadError] = useState('');

  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<NoticeTone>('info');
  const [sectionRetryError, setSectionRetryError] = useState<SectionRetryError>(null);

  const [busy, setBusy] = useState(false);
  const [busyActionKey, setBusyActionKey] = useState('');
  const [siteBusyId, setSiteBusyId] = useState('');

  const [confirmApptId, setConfirmApptId] = useState<string | null>(null);
  const [shareConfirmId, setShareConfirmId] = useState<string | null>(null);
  const [completionConfirmationId, setCompletionConfirmationId] = useState<string | null>(null);
  const [readyConfirmationId, setReadyConfirmationId] = useState<string | null>(null);
  const [reviewOpenId, setReviewOpenId] = useState<string | null>(null);

  const [reviewDrafts, setReviewDrafts] = useState<BookingReviewDrafts>(() => new Map());
  const [reviewError, setReviewError] = useState<string | null>(null);

  const refreshRequest = useRef(0);
  const userIdRef = useRef('');
  const actionLockRef = useRef(createSingleFlightLock());
  const detailHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null);

  function showNotice(text: string, tone: NoticeTone = 'info') {
    setNotice(text);
    setNoticeTone(tone);
  }

  function resetBookingDrawers() {
    setConfirmApptId(null);
    setShareConfirmId(null);
    setCompletionConfirmationId(null);
    setReadyConfirmationId(null);
    setReviewOpenId(null);
    setReviewError(null);
    setSectionRetryError(null);
  }

  const refresh = useCallback(async (user: string, options?: {preserveNotice?: boolean}) => {
    const currentRequest = ++refreshRequest.current;
    // Never retain previously retrieved private job-site addresses while
    // booking ownership and consent are being rechecked.
    setSites({});
    setSiteUnavailableIds([]);
    setLoadingBookings(true);
    if (!options?.preserveNotice) {
      setInitialLoadError('');
    }
    try {
      const s = supabaseBrowser();
      const [b, r, ap] = await Promise.all([
        s
          .from('job_bookings')
          .select('id,quote_id,job_id,customer_id,professional_id,status,created_at')
          .or('customer_id.eq.' + user + ',professional_id.eq.' + user)
          .order('created_at', {ascending: false})
          .limit(75),
        s.from('booking_reviews').select('booking_id').eq('author_id', user),
        s
          .from('booking_appointments')
          .select('booking_id,proposed_by,status,starts_at,ends_at,timezone_name'),
      ]);
      if (b.error) throw b.error;
      if (r.error) throw r.error;
      if (currentRequest !== refreshRequest.current) return;

      const recent = (b.data || []) as Booking[];
      const requested = new URLSearchParams(window.location.search).getAll('booking');
      const linked = await resolveLinkedBooking(requested, recent, user, async id => {
        const {data, error} = await s.from('job_bookings')
          .select('id,quote_id,job_id,customer_id,professional_id,status,created_at')
          .or('customer_id.eq.' + user + ',professional_id.eq.' + user)
          .eq('id', id).maybeSingle();
        if (error) throw error;
        return data as Booking | null;
      });
      if (currentRequest !== refreshRequest.current) return;
      const records = linked.records;
      setBookings(records);
      setReviews((r.data || []) as Review[]);
      setInitialLoadError('');

      const apptMap: Record<string, Appointment> = {};
      if (!ap.error && ap.data) {
        for (const item of ap.data as Appointment[]) {
          apptMap[item.booking_id] = item;
        }
      }
      setAppointments(apptMap);

      const authorised = linked.selectedId;
      setDeepLinkBookingId(authorised);
      setUnavailableBooking(requested.length > 0 && !authorised);
      if (authorised) {
        setSelectedBookingId(prev => prev || authorised);
      }

      // Non-blocking job title & quote enrichment using existing RLS & RPCs.
      const customerJobIds = Array.from(
        new Set(records.filter(item => item.customer_id === user).map(item => item.job_id))
      );
      const hasCustomerBookings = customerJobIds.length > 0;
      const hasProBookings = records.some(item => item.professional_id === user);

      const enrichmentPromise = (async () => {
        const nextEnrich: Record<string, BookingEnrichment> = {};
        const jobTitleById: Record<string, string> = {};
        const quoteMetaById: Record<
          string,
          {jobTitle?: string; businessName?: string; amountPence?: number}
        > = {};

        const tasks: Promise<void>[] = [];
        if (hasCustomerBookings) {
          tasks.push(
            (async () => {
              const {data, error} = await s
                .from('jobs')
                .select('id,title')
                .in('id', customerJobIds);
              if (!error && Array.isArray(data)) {
                for (const row of data as Array<{id: string; title?: string | null}>) {
                  if (row.id && row.title) jobTitleById[row.id] = row.title;
                }
              }
            })().catch(() => {})
          );
          tasks.push(
            (async () => {
              const {data, error} = await s.rpc('customer_quotes');
              if (!error && Array.isArray(data)) {
                for (const row of data as Array<{
                  quote_id: string;
                  business_name?: string | null;
                  amount_pence?: number | null;
                }>) {
                  if (row.quote_id) {
                    quoteMetaById[row.quote_id] = {
                      ...quoteMetaById[row.quote_id],
                      businessName: row.business_name || undefined,
                      amountPence:
                        typeof row.amount_pence === 'number' ? row.amount_pence : undefined,
                    };
                  }
                }
              }
            })().catch(() => {})
          );
        }

        if (hasProBookings) {
          tasks.push(
            (async () => {
              const {data, error} = await s.rpc('professional_quotes');
              if (!error && Array.isArray(data)) {
                for (const row of data as Array<{
                  quote_id: string;
                  job_title?: string | null;
                  amount_pence?: number | null;
                }>) {
                  if (row.quote_id) {
                    quoteMetaById[row.quote_id] = {
                      ...quoteMetaById[row.quote_id],
                      jobTitle: row.job_title || undefined,
                      amountPence:
                        typeof row.amount_pence === 'number' ? row.amount_pence : undefined,
                    };
                  }
                }
              }
            })().catch(() => {})
          );
        }

        await Promise.all(tasks);
        if (currentRequest !== refreshRequest.current) return;

        for (const item of records) {
          const qMeta = quoteMetaById[item.quote_id];
          const resolvedTitle = jobTitleById[item.job_id] || qMeta?.jobTitle;
          if (resolvedTitle || qMeta?.businessName || typeof qMeta?.amountPence === 'number') {
            nextEnrich[item.id] = {
              jobTitle: resolvedTitle,
              businessName: qMeta?.businessName,
              amountPence: qMeta?.amountPence,
            };
          }
        }
        setEnrichments(nextEnrich);
      })();

      // Each RPC is individually authorised in the database. A denied or timed-out
      // lookup must not make unrelated bookings disappear from the customer UI.
      const siteBatchPromise = loadBookingSiteBatch<JobSite>(
        records.map(booking => booking.id),
        async bookingId => {
          const {data, error} = await s.rpc('booking_job_site_address', {p_booking: bookingId});
          if (error) throw error;
          return (data?.[0] || null) as JobSite | null;
        }
      );

      const [, siteResult] = await Promise.all([enrichmentPromise, siteBatchPromise]);
      if (currentRequest !== refreshRequest.current) return;
      setSites(siteResult.sites);
      setSiteUnavailableIds(siteResult.unavailableIds);
    } finally {
      if (currentRequest === refreshRequest.current) {
        setLoadingBookings(false);
      }
    }
  }, []);

  const loadInitialBookings = useCallback(async () => {
    setCheckingAccount(true);
    setInitialLoadError('');
    try {
      const {
        data: {user},
        error,
      } = await supabaseBrowser().auth.getUser();
      if (error) throw error;
      if (!user) {
        userIdRef.current = '';
        setUserId('');
        showNotice('Sign in to manage your bookings.', 'info');
        return;
      }
      userIdRef.current = user.id;
      setUserId(user.id);
      await refresh(user.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to load bookings right now.';
      setInitialLoadError(msg);
      showNotice(msg, 'error');
    } finally {
      setCheckingAccount(false);
    }
  }, [refresh]);

  useEffect(() => {
    void loadInitialBookings();
  }, [loadInitialBookings]);

  const reviewedBookingIds = useMemo(
    () => new Set(reviews.map(r => r.booking_id)),
    [reviews]
  );

  const filterCounts = useMemo(
    () => summarizeBookingStatuses(bookings, userId, appointments, reviewedBookingIds),
    [bookings, userId, appointments, reviewedBookingIds]
  );

  const visibleBookings = useMemo(
    () => filterBookings(bookings, statusFilter, userId, appointments, reviewedBookingIds),
    [bookings, statusFilter, userId, appointments, reviewedBookingIds]
  );

  const effectiveSelectedId = useMemo(
    () =>
      resolveSelectedBookingId({
        visibleIds: visibleBookings.map(b => b.id),
        currentSelectedId: selectedBookingId,
        deepLinkBookingId,
      }),
    [visibleBookings, selectedBookingId, deepLinkBookingId]
  );

  const selectedBooking = useMemo(
    () => visibleBookings.find(b => b.id === effectiveSelectedId) || null,
    [visibleBookings, effectiveSelectedId]
  );

  const selectedReviewDraft = bookingReviewDraft(reviewDrafts, selectedBooking?.id ?? '');

  function handleSelectBooking(bookingId: string) {
    if (bookingId !== selectedBookingId) {
      resetBookingDrawers();
    }
    setSelectedBookingId(bookingId);
    if (typeof window !== 'undefined' && window.innerWidth <= 960) {
      window.requestAnimationFrame(() => {
        detailHeadingRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
        detailHeadingRef.current?.focus({preventScroll: true});
      });
    }
  }

  function handleBackToList() {
    listHeadingRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
    listHeadingRef.current?.focus({preventScroll: true});
  }

  function handleFilterChange(nextFilter: BookingStatusFilter) {
    setStatusFilter(nextFilter);
    setSectionRetryError(null);
  }

  async function confirmAppointment(booking: Booking) {
    if (busy || loadingBookings) return;
    await actionLockRef.current.run(async () => {
      setBusy(true);
      setBusyActionKey(`confirm_booking_appointment:${booking.id}`);
      setSectionRetryError(null);
      setNotice('');
      try {
        const result = await executeBookingAction({
          runRpc: async () =>
            await supabaseBrowser().rpc('confirm_booking_appointment', {p_booking: booking.id}),
          onCommittedLocalUpdate: () => {
            setConfirmApptId(null);
            setAppointments(prev => applyCommittedAppointmentMap(prev, booking.id, 'confirmed'));
          },
          runRefresh: () => refresh(userIdRef.current, {preserveNotice: true}),
          successMessage:
            'Appointment time confirmed. Both participants now see the agreed visit window.',
          refreshFailedMessage:
            'Your appointment confirmation was recorded, but the page could not refresh automatically. Reload to check the latest details.',
          fallbackErrorMessage: 'Unable to confirm appointment time.',
        });

        if (result.outcome === 'rpc_error') {
          setSectionRetryError({section: 'appointment', message: result.message});
          showNotice(result.message, 'error');
        } else if (result.outcome === 'committed_refresh_failed') {
          showNotice(result.message, 'warn');
        } else {
          showNotice(result.message, 'info');
        }
      } finally {
        setBusy(false);
        setBusyActionKey('');
      }
    });
  }

  async function shareAddress(booking: Booking, enabled: boolean) {
    if (busy || siteBusyId) return;
    await actionLockRef.current.run(async () => {
      setSiteBusyId(booking.id);
      setShareConfirmId(null);
      setSectionRetryError(null);
      setNotice('');
      // Clear ONLY the target booking's cached address and mark it as needing
      // recheck until a live server check succeeds, preserving unrelated bookings.
      setSites(prev => clearBookingSiteCache(prev, booking.id));
      setSiteUnavailableIds(prev => markBookingSiteNeedsRecheck(prev, booking.id));
      try {
        const result = await executeBookingAction({
          runRpc: async () =>
            await supabaseBrowser().rpc('set_booking_address_sharing', {
              p_booking: booking.id,
              p_allow: enabled,
            }),
          onCommittedLocalUpdate: () => {},
          runRefresh: () => refresh(userIdRef.current, {preserveNotice: true}),
          successMessage: enabled
            ? 'Exact address sharing is now on for this booked professional only.'
            : 'Exact address sharing has been turned off for this booking.',
          refreshFailedMessage: enabled
            ? 'Address sharing was enabled, but the updated status could not be reloaded. Use "Recheck address status" to verify.'
            : 'Address sharing was turned off, but the updated status could not be reloaded. Use "Recheck address status" to verify.',
          fallbackErrorMessage: 'Unable to update private address sharing.',
        });

        if (result.outcome === 'rpc_error') {
          setSectionRetryError({section: 'address', message: result.message});
          showNotice(result.message, 'error');
        } else if (result.outcome === 'committed_refresh_failed') {
          showNotice(result.message, 'warn');
        } else {
          showNotice(result.message, 'info');
        }
      } finally {
        setSiteBusyId('');
      }
    });
  }

  async function act(
    action: 'mark_job_ready_for_confirmation' | 'confirm_job_completed',
    booking: Booking
  ) {
    if (busy || loadingBookings) return;
    if (
      action === 'confirm_job_completed' &&
      !canConfirmCompletedBooking(completionConfirmationId, booking, userIdRef.current)
    ) {
      setCompletionConfirmationId(null);
      showNotice(
        'This booking is not ready for your completion confirmation. Refresh your bookings and try again.',
        'warn'
      );
      return;
    }

    await actionLockRef.current.run(async () => {
      setBusy(true);
      setBusyActionKey(`${action}:${booking.id}`);
      setSectionRetryError(null);
      setNotice('');
      try {
        const nextStatus = action === 'confirm_job_completed' ? 'completed' : 'awaiting_customer';
        const result = await executeBookingAction({
          runRpc: async () => await supabaseBrowser().rpc(action, {p_booking: booking.id}),
          onCommittedLocalUpdate: () => {
            setCompletionConfirmationId(null);
            setReadyConfirmationId(null);
            setBookings(prev => applyCommittedBookingStatus(prev, booking.id, nextStatus));
          },
          runRefresh: () => refresh(userIdRef.current, {preserveNotice: true}),
          successMessage:
            action === 'confirm_job_completed'
              ? 'You confirmed the work as completed. You can now leave a verified-booking review below.'
              : 'Work marked ready for customer confirmation. The customer must independently confirm completion.',
          refreshFailedMessage:
            action === 'confirm_job_completed'
              ? 'Your completion confirmation was saved, but the booking list could not refresh automatically. Reload to check the latest details.'
              : 'Work was marked ready, but the booking list could not refresh automatically. Reload to check the latest details.',
          fallbackErrorMessage: 'Unable to update booking status.',
        });

        if (result.outcome === 'rpc_error') {
          setSectionRetryError({section: 'completion', message: result.message});
          showNotice(result.message, 'error');
        } else if (result.outcome === 'committed_refresh_failed') {
          showNotice(result.message, 'warn');
        } else {
          showNotice(result.message, 'info');
        }
      } finally {
        setBusy(false);
        setBusyActionKey('');
      }
    });
  }

  async function handleSubmitReview(e: FormEvent, booking: Booking) {
    e.preventDefault();
    if (busy || loadingBookings || reviewOpenId !== booking.id || booking.customer_id !== userIdRef.current ||
        booking.status !== 'completed' || reviewedBookingIds.has(booking.id)) return;
    const {stars, body: reviewBody} = bookingReviewDraft(reviewDrafts, booking.id);
    const validationError = validateBookingReviewInput(stars, reviewBody);
    if (validationError) {
      setReviewError(validationError);
      return;
    }
    setReviewError(null);

    await actionLockRef.current.run(async () => {
      setBusy(true);
      setBusyActionKey(`review:${booking.id}`);
      setSectionRetryError(null);
      setNotice('');
      try {
        const rating = Number(stars);
        const trimmed = reviewBody.trim();
        const result = await executeBookingAction({
          runRpc: async () =>
            await supabaseBrowser().from('booking_reviews').insert({
              booking_id: booking.id,
              author_id: userIdRef.current,
              professional_id: booking.professional_id,
              stars: rating,
              body: trimmed,
            }),
          onCommittedLocalUpdate: () => {
            setReviews(prev => applyCommittedReview(prev, booking.id));
            setReviewOpenId(current => current === booking.id ? null : current);
            setReviewDrafts(current => updateBookingReviewDraft(current, booking.id, null));
          },
          runRefresh: () => refresh(userIdRef.current, {preserveNotice: true}),
          successMessage: 'Verified-booking review submitted. Thank you for sharing your experience.',
          refreshFailedMessage:
            'Your verified-booking review was saved, but the page could not refresh automatically.',
          fallbackErrorMessage: 'Unable to submit review. Please try again.',
        });

        if (result.outcome === 'rpc_error') {
          setSectionRetryError({section: 'review', message: result.message});
          showNotice(result.message, 'error');
        } else if (result.outcome === 'committed_refresh_failed') {
          showNotice(result.message, 'warn');
        } else {
          showNotice(result.message, 'info');
        }
      } finally {
        setBusy(false);
        setBusyActionKey('');
      }
    });
  }

  async function handleRetryRefresh() {
    if (!userIdRef.current) {
      await loadInitialBookings();
      return;
    }
    try {
      await refresh(userIdRef.current);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not refresh bookings right now.';
      showNotice(msg, 'error');
    }
  }

  return (
    <main className="container bookings-page">
      <div className="page-heading bookings-page-head">
        <div>
          <span className="eyebrow">Bookings and quality</span>
          <h1>My bookings</h1>
          <p className="subtle">
            See what is happening on each booking, what you need to do next, and how to confirm completion or leave a verified review.
          </p>
        </div>
        <div className="bookings-head-actions">
          <Link className="btn secondary" href="/schedule">
            Manage appointment times
          </Link>
          <Link className="btn secondary" href="/jobs">
            My jobs
          </Link>
        </div>
      </div>

      {notice ? (
        <p
          className={`notice${noticeTone === 'error' ? ' error' : noticeTone === 'warn' ? ' notice-warn' : ''}`}
          role={noticeTone === 'error' ? 'alert' : 'status'}
          aria-live={noticeTone === 'error' ? 'assertive' : 'polite'}
          data-testid="bookings-notice"
        >
          {notice}
        </p>
      ) : null}

      {checkingAccount ? (
        <div className="card" role="status" aria-live="polite" data-testid="bookings-loading">
          <p style={{margin: 0}}>Checking your account and loading your bookings…</p>
        </div>
      ) : initialLoadError && !userId ? (
        <div className="card" role="alert" data-testid="bookings-load-error">
          <h2>Could not load your bookings</h2>
          <p className="subtle" style={{marginBottom: 14}}>
            {initialLoadError}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => void loadInitialBookings()}
          >
            Try again
          </button>
        </div>
      ) : !userId ? (
        <div className="card">
          <h2>Sign in to manage your bookings</h2>
          <p className="subtle" style={{marginBottom: 14}}>
            Your bookings, appointments, and private address sharing preferences are linked to your TrustFive account.
          </p>
          <Link className="btn" href="/account?next=%2Fbookings">
            Sign in to see your bookings
          </Link>
        </div>
      ) : initialLoadError && bookings.length === 0 ? (
        <div className="card" role="alert" data-testid="bookings-load-error">
          <h2>We could not load your bookings</h2>
          <p className="subtle" style={{marginBottom: 14}}>
            {initialLoadError}
          </p>
          <button
            type="button"
            className="btn"
            disabled={loadingBookings}
            onClick={() => void handleRetryRefresh()}
          >
            {loadingBookings ? 'Retrying…' : 'Retry loading bookings'}
          </button>
        </div>
      ) : (
        <>
          <div className="booking-overview" aria-label="Booking summary">
            <div className="card">
              <strong data-testid="count-needs-action">{filterCounts.needs_action}</strong>
              <span>Needs your action</span>
            </div>
            <div className="card">
              <strong data-testid="count-active">{filterCounts.active}</strong>
              <span>Active bookings</span>
            </div>
            <div className="card">
              <strong data-testid="count-completed">{filterCounts.completed}</strong>
              <span>Completed</span>
            </div>
          </div>

          <div
            className="job-filter-bar"
            role="group"
            aria-label="Filter bookings"
            data-testid="booking-filter-bar"
          >
            {FILTER_OPTIONS.map(({key, label}) => {
              const count = filterCounts[key];
              const isSelected = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`job-filter-btn${isSelected ? ' is-active' : ''}`}
                  aria-pressed={isSelected}
                  data-testid={`filter-${key}`}
                  onClick={() => handleFilterChange(key)}
                >
                  <span>{label}</span>
                  <span className="job-filter-count">{count}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="btn secondary bookings-refresh-btn"
              disabled={loadingBookings || busy}
              onClick={() => void handleRetryRefresh()}
            >
              {loadingBookings ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {unavailableBooking ? (
            <p role="alert" className="notice error" data-testid="unavailable-booking-alert">
              Could not open that booking. Check the link or refresh to try again. Your recent bookings are listed below.
            </p>
          ) : null}

          {deepLinkBookingId ? (
            <p role="status" className="notice" data-testid="deeplink-booking-notice">
              Opened your linked booking below. You can switch to any of your other bookings from the list.
            </p>
          ) : null}

          {siteUnavailableIds.length > 0 ? (
            <div className="notice notice-warn" role="status" data-testid="site-unavailable-banner">
              <p style={{margin: '0 0 10px'}}>
                Booking history is available, but private address sharing could not be checked for{' '}
                {siteUnavailableIds.length} booking{siteUnavailableIds.length === 1 ? '' : 's'}. No cached address is shown until its live access check succeeds.
              </p>
              <button
                type="button"
                className="btn secondary"
                disabled={loadingBookings || busy}
                onClick={() => void handleRetryRefresh()}
              >
                {loadingBookings ? 'Checking…' : 'Retry address checks'}
              </button>
            </div>
          ) : null}

          {bookings.length === 0 ? (
            <div className="card bookings-empty" data-testid="bookings-empty-state">
              <h2>No confirmed bookings yet</h2>
              <p className="subtle" style={{marginBottom: 16}}>
                Once you accept a professional&apos;s quote on one of your jobs, your booking will appear here with appointment scheduling, private address controls, and completion tracking.
              </p>
              <div className="job-actions-bar">
                <Link className="btn" href="/jobs">
                  Go to My jobs
                </Link>
                <Link className="btn secondary" href="/services">
                  Browse verified professionals
                </Link>
              </div>
            </div>
          ) : (
            <div className="bookings-hub-grid">
              <section className="bookings-list-col" aria-labelledby="bookings-list-heading">
                <div className="bookings-list-head">
                  <h2 id="bookings-list-heading" ref={listHeadingRef} tabIndex={-1}>
                    Your bookings ({visibleBookings.length})
                  </h2>
                  <p className="muted-note" style={{margin: 0}}>
                    Select a booking to view appointment, address sharing, and completion actions.
                  </p>
                </div>

                {visibleBookings.length === 0 ? (
                  <div className="card" data-testid="bookings-filtered-empty">
                    <p style={{margin: '0 0 12px'}}>
                      No bookings are in the <strong>{FILTER_OPTIONS.find(f => f.key === statusFilter)?.label}</strong> view right now.
                    </p>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => handleFilterChange('all')}
                    >
                      Show all bookings ({filterCounts.all})
                    </button>
                  </div>
                ) : (
                  <div className="bookings-list" role="list" aria-label="Booking list">
                    {visibleBookings.map(b => {
                      const meta = enrichments[b.id];
                      return (
                        <div role="listitem" key={b.id}>
                          <BookingListItem
                            booking={b}
                            userId={userId}
                            jobTitle={meta?.jobTitle}
                            businessName={meta?.businessName}
                            amountPence={meta?.amountPence}
                            appointment={appointments[b.id] || null}
                            siteInfo={sites[b.id] || null}
                            siteUnavailable={siteUnavailableIds.includes(b.id)}
                            hasReviewed={reviewedBookingIds.has(b.id)}
                            selected={b.id === effectiveSelectedId}
                            onSelect={handleSelectBooking}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="bookings-detail-col" aria-label="Selected booking details">
                {selectedBooking ? (
                  <SelectedBookingDetail
                    headingRef={detailHeadingRef}
                    booking={selectedBooking}
                    userId={userId}
                    jobTitle={enrichments[selectedBooking.id]?.jobTitle}
                    businessName={enrichments[selectedBooking.id]?.businessName}
                    amountPence={enrichments[selectedBooking.id]?.amountPence}
                    appointment={appointments[selectedBooking.id] || null}
                    siteInfo={sites[selectedBooking.id] || null}
                    siteUnavailable={siteUnavailableIds.includes(selectedBooking.id)}
                    hasReviewed={reviewedBookingIds.has(selectedBooking.id)}
                    loadingBookings={loadingBookings}
                    busy={busy}
                    busyActionKey={busyActionKey}
                    siteBusy={siteBusyId === selectedBooking.id}
                    confirmApptOpen={confirmApptId === selectedBooking.id}
                    shareConfirmOpen={shareConfirmId === selectedBooking.id}
                    completionConfirmOpen={completionConfirmationId === selectedBooking.id}
                    readyConfirmOpen={readyConfirmationId === selectedBooking.id}
                    reviewOpen={reviewOpenId === selectedBooking.id}
                    stars={selectedReviewDraft.stars}
                    reviewBody={selectedReviewDraft.body}
                    reviewError={reviewError}
                    sectionRetryError={sectionRetryError}
                    onBackToList={handleBackToList}
                    onOpenConfirmAppt={() => {
                      setConfirmApptId(selectedBooking.id);
                      setSectionRetryError(null);
                    }}
                    onAbortConfirmAppt={() => setConfirmApptId(null)}
                    onConfirmAppt={() => void confirmAppointment(selectedBooking)}
                    onOpenShareConfirm={() => {
                      setShareConfirmId(selectedBooking.id);
                      setSectionRetryError(null);
                    }}
                    onAbortShareConfirm={() => setShareConfirmId(null)}
                    onToggleAddressSharing={enabled => void shareAddress(selectedBooking, enabled)}
                    onRecheckAddress={() => void handleRetryRefresh()}
                    onOpenCompletionConfirm={() => {
                      setCompletionConfirmationId(selectedBooking.id);
                      setSectionRetryError(null);
                      setNotice('');
                    }}
                    onAbortCompletionConfirm={() => setCompletionConfirmationId(null)}
                    onConfirmCompletion={() => void act('confirm_job_completed', selectedBooking)}
                    onOpenReadyConfirm={() => {
                      setReadyConfirmationId(selectedBooking.id);
                      setSectionRetryError(null);
                      setNotice('');
                    }}
                    onAbortReadyConfirm={() => setReadyConfirmationId(null)}
                    onConfirmReady={() => void act('mark_job_ready_for_confirmation', selectedBooking)}
                    onOpenReview={() => {
                      setReviewOpenId(selectedBooking.id);
                      setReviewError(null);
                      setSectionRetryError(null);
                    }}
                    onCloseReview={() => {
                      setReviewOpenId(null);
                      setReviewError(null);
                    }}
                    onStarsChange={stars => setReviewDrafts(current => updateBookingReviewDraft(current, selectedBooking.id, {stars}))}
                    onReviewBodyChange={val => {
                      setReviewDrafts(current => updateBookingReviewDraft(current, selectedBooking.id, {body: val}));
                      if (reviewError) setReviewError(null);
                    }}
                    onSubmitReview={e => void handleSubmitReview(e, selectedBooking)}
                  />
                ) : (
                  <div className="card">
                    <h3>Select a booking</h3>
                    <p className="muted-note">
                      Choose a booking from the list to inspect appointment details, private address sharing, and completion actions.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
