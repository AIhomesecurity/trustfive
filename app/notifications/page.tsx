'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {safeNotificationTarget} from '../../lib/notification-target';
import {
  classifyNotificationReadFailure,
  countUnreadNotifications,
  filterAccountNotifications,
  NOTIFICATION_DELIVERY_CHANNELS,
  notificationDeliveryLabel,
  type AccountNotificationRecord,
  type NotificationFilter,
} from '../../lib/notification-delivery';

export default function Notifications() {
  const [items, setItems] = useState<AccountNotificationRecord[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [signedIn, setSignedIn] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionIsError, setActionIsError] = useState(false);
  const [failedReadIds, setFailedReadIds] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const refreshAlertRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const fetchNotifications = useCallback(async () => {
    const {data, error} = await supabaseBrowser()
      .from('account_notifications')
      .select('id,kind,title,body,target_path,created_at,read_at')
      .order('created_at', {ascending: false})
      .limit(75);
    if (error) throw error;
    setItems((data || []) as AccountNotificationRecord[]);
  }, []);

  const loadAccountAndNotifications = useCallback(async () => {
    setCheckingAccount(true);
    setLoadError('');
    setRefreshError('');
    setActionNotice('');
    setActionIsError(false);
    setFailedReadIds({});
    try {
      const {
        data: {user},
        error,
      } = await supabaseBrowser().auth.getUser();
      if (error) throw error;
      if (!user) {
        setSignedIn(false);
        setItems([]);
        return;
      }
      setSignedIn(true);
      await fetchNotifications();
    } catch {
      setLoadError('Unable to load your notifications. Please try again.');
    } finally {
      setCheckingAccount(false);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    void loadAccountAndNotifications();
  }, [loadAccountAndNotifications]);

  async function refreshInbox() {
    if (refreshing || busy || inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    setRefreshError('');
    setActionNotice('');
    setActionIsError(false);
    try {
      await fetchNotifications();
      setFailedReadIds({});
    } catch {
      setRefreshError('Could not refresh notifications. Your previously loaded items remain visible below.');
      window.requestAnimationFrame(() => refreshAlertRef.current?.focus());
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }

  async function markRead(id: string) {
    if (busy || refreshing || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(id);
    setActionNotice('');
    setActionIsError(false);
    setRefreshError('');
    try {
      const {data, error} = await supabaseBrowser().rpc('mark_notification_read', {
        p_notification: id,
      });
      if (error) throw error;
      if (data !== true) {
        const classified = classifyNotificationReadFailure(new Error('Notification not found'));
        setFailedReadIds(prev => {
          const next = {...prev};
          delete next[id];
          return next;
        });
        try {
          await fetchNotifications();
        } catch {
          // Keep current state visible if follow-up refresh also fails.
        }
        setActionIsError(false);
        setActionNotice(classified.message);
        return;
      }
      setItems(prev =>
        prev.map(item =>
          item.id === id ? {...item, read_at: item.read_at ?? new Date().toISOString()} : item
        )
      );
      setFailedReadIds(prev => {
        const next = {...prev};
        delete next[id];
        return next;
      });
      setActionIsError(false);
      setActionNotice('Notification marked as read.');
      try {
        await fetchNotifications();
      } catch {
        setActionNotice('Notification marked as read. Refresh to sync newer updates.');
      }
    } catch (err) {
      const classified = classifyNotificationReadFailure(err);
      setFailedReadIds(prev => ({...prev, [id]: true}));
      setActionIsError(true);
      setActionNotice(classified.message);
      window.requestAnimationFrame(() => noticeRef.current?.focus());
    } finally {
      inFlightRef.current = false;
      setBusy('');
    }
  }

  const unreadCount = useMemo(() => countUnreadNotifications(items), [items]);
  const readCount = items.length - unreadCount;
  const visibleItems = useMemo(() => filterAccountNotifications(items, filter), [items, filter]);

  return (
    <main className="container social-hub">
      <div className="page-heading">
        <span className="eyebrow">Private account activity</span>
        <h1 ref={headingRef} tabIndex={-1}>
          Notifications
        </h1>
        <p className="subtle">
          Keep track of quotes, bookings, messages and professional vacancy offers. Delivery channels are shown honestly below.
        </p>
      </div>

      <section
        className="notification-delivery-bar"
        aria-label="Notification delivery channels"
        data-testid="notification-delivery-status"
      >
        <div className="notification-channel-list">
          {NOTIFICATION_DELIVERY_CHANNELS.map(channel => (
            <span
              key={channel.id}
              className={`notification-channel-pill ${channel.enabled ? 'is-active' : 'is-disabled'}`}
            >
              <strong>{channel.label}:</strong> {channel.statusLabel}
            </span>
          ))}
        </div>
        <p className="muted-note" style={{margin: 0}}>
          In-app notifications are recorded in your private account inbox. Automated email, mobile push, SMS and real-time community event alerts are not yet enabled.
        </p>
      </section>

      {checkingAccount ? (
        <div className="card" role="status" aria-live="polite">
          Loading your notifications…
        </div>
      ) : loadError ? (
        <div className="card" role="alert">
          <p style={{margin: '0 0 12px'}}>{loadError}</p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              headingRef.current?.focus();
              void loadAccountAndNotifications();
            }}
          >
            Retry loading notifications
          </button>
        </div>
      ) : !signedIn ? (
        <div className="card">
          <p style={{margin: '0 0 12px'}}>Sign in to see your private notifications.</p>
          <Link className="btn" href="/account?next=%2Fnotifications">
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="notification-filter-bar" role="group" aria-label="Filter notifications">
            <button
              type="button"
              className={filter === 'all' ? 'job-filter-btn is-active' : 'job-filter-btn'}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All <span className="job-filter-count">{items.length}</span>
            </button>
            <button
              type="button"
              className={filter === 'unread' ? 'job-filter-btn is-active' : 'job-filter-btn'}
              aria-pressed={filter === 'unread'}
              onClick={() => setFilter('unread')}
            >
              Unread <span className="job-filter-count">{unreadCount}</span>
            </button>
            <button
              type="button"
              className={filter === 'read' ? 'job-filter-btn is-active' : 'job-filter-btn'}
              aria-pressed={filter === 'read'}
              onClick={() => setFilter('read')}
            >
              Read <span className="job-filter-count">{readCount}</span>
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={refreshing || busy !== ''}
              onClick={() => void refreshInbox()}
            >
              {refreshing ? 'Refreshing…' : 'Refresh notifications'}
            </button>
          </div>

          {refreshError ? (
            <div ref={refreshAlertRef} tabIndex={-1} className="notice error" role="alert" style={{marginBottom: 14}}>
              <p style={{margin: '0 0 8px'}}>{refreshError}</p>
              <button
                type="button"
                className="btn secondary"
                disabled={refreshing || busy !== ''}
                onClick={() => void refreshInbox()}
              >
                Retry refresh
              </button>
            </div>
          ) : null}

          {actionNotice ? (
            <p
              ref={noticeRef}
              tabIndex={-1}
              className={actionIsError ? 'notice error' : 'notice'}
              role={actionIsError ? 'alert' : 'status'}
            >
              {actionNotice}
            </p>
          ) : null}

          <section className="list" aria-label="Your notifications">
            {visibleItems.length === 0 ? (
              <div className="card" role="status">
                <h2 style={{marginTop: 0}}>
                  {filter === 'unread'
                    ? 'No unread notifications'
                    : filter === 'read'
                      ? 'No read notifications yet'
                      : 'All caught up'}
                </h2>
                <p style={{marginBottom: 0}}>
                  {filter === 'all'
                    ? 'New account activity will appear here.'
                    : 'Switch back to All notifications to see the rest of your inbox.'}
                </p>
              </div>
            ) : (
              visibleItems.map(item => (
                <article className="card" key={item.id}>
                  <div className="social-post-meta">
                    <span className="pill">{notificationDeliveryLabel(item)}</span>
                    <time className="muted-note social-post-time" dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString('en-GB')}
                    </time>
                  </div>
                  <h2 style={{margin: '8px 0'}}>{item.title}</h2>
                  <p>{item.body}</p>
                  <div className="social-hub-shortcuts" style={{marginBottom: 0}}>
                    {safeNotificationTarget(item.target_path) ? (
                      <Link className="btn secondary" href={safeNotificationTarget(item.target_path)!}>
                        View details
                      </Link>
                    ) : null}
                    {!item.read_at ? (
                      <button
                        type="button"
                        disabled={busy !== '' || refreshing}
                        className="btn secondary"
                        onClick={() => void markRead(item.id)}
                      >
                        {busy === item.id ? 'Saving…' : 'Mark as read'}
                      </button>
                    ) : null}
                  </div>
                  {failedReadIds[item.id] && !item.read_at ? (
                    <p className="muted-note" style={{margin: '8px 0 0'}}>
                      Last attempt did not save — try marking as read again.
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
