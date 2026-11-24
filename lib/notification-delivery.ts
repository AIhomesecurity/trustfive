export type NotificationDeliveryChannel = {
  id: 'in_app' | 'email' | 'push' | 'sms';
  label: string;
  enabled: boolean;
  statusLabel: string;
};

export type AccountNotificationRecord = {
  id: string;
  kind: string;
  title: string;
  body: string;
  target_path: string;
  created_at: string;
  read_at: string | null;
};

export type NotificationFilter = 'all' | 'unread' | 'read';

export const NOTIFICATION_DELIVERY_CHANNELS: readonly NotificationDeliveryChannel[] = [
  {id: 'in_app', label: 'In-app inbox', enabled: true, statusLabel: 'Active'},
  {id: 'email', label: 'Email', enabled: false, statusLabel: 'Not yet enabled'},
  {id: 'push', label: 'Mobile push', enabled: false, statusLabel: 'Not yet enabled'},
  {id: 'sms', label: 'SMS', enabled: false, statusLabel: 'Not yet enabled'},
];

export function countUnreadNotifications(
  items: readonly Pick<AccountNotificationRecord, 'read_at'>[]
): number {
  return items.filter(item => !item.read_at).length;
}

export function filterAccountNotifications<T extends Pick<AccountNotificationRecord, 'read_at'>>(
  items: readonly T[],
  filter: NotificationFilter
): T[] {
  if (filter === 'unread') return items.filter(item => !item.read_at);
  if (filter === 'read') return items.filter(item => Boolean(item.read_at));
  return [...items];
}

export function notificationDeliveryLabel(item: Pick<AccountNotificationRecord, 'read_at'>): string {
  return item.read_at ? 'Read in app' : 'Delivered in app · Unread';
}
