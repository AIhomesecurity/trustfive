export type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  target_path: unknown;
  created_at: string;
  read_at: string | null;
};

export type InboxFilter = 'all' | 'unread' | 'read';
export type InboxCategory = 'all' | 'quotes' | 'bookings' | 'messages' | 'vacancies' | 'other';

export const inboxCategories = [
  { value: 'all', label: 'All categories' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'messages', label: 'Messages' },
  { value: 'vacancies', label: 'Vacancies' },
  { value: 'other', label: 'Other' }
] as const;

function mapKindToCategory(kind: string): InboxCategory {
  switch (kind) {
    case 'new_quote':
    case 'quote_accepted':
      return 'quotes';
    case 'new_message':
      return 'messages';
    case 'work_ready':
    case 'job_completed':
      return 'bookings';
    case 'vacancy_offer':
      return 'vacancies';
    default:
      return 'other';
  }
}

export function filterInbox(
  items: readonly InboxItem[],
  filter: InboxFilter,
  category: InboxCategory,
  search: string
): InboxItem[] {
  const lowerCaseSearch = search.trim().toLowerCase();

  return items.filter(item => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && item.read_at === null) ||
      (filter === 'read' && item.read_at !== null);

    const matchesCategory =
      category === 'all' || mapKindToCategory(item.kind) === category;

    const matchesSearch =
      item.title.toLowerCase().includes(lowerCaseSearch) ||
      item.body.toLowerCase().includes(lowerCaseSearch);

    return matchesFilter && matchesCategory && matchesSearch;
  });
}

export function unreadInboxCount(items: readonly InboxItem[]): number {
  return items.reduce((count, item) => count + (item.read_at === null ? 1 : 0), 0);
}
