import { test, expect } from '@playwright/test';
import { type InboxItem, filterInbox, unreadInboxCount } from '../../lib/notification-inbox';

const syntheticData: InboxItem[] = [
  { id: '1', kind: 'new_quote', title: 'New Quote', body: 'Quote details here', target_path: '/quote/1', created_at: '2023-10-01T10:00:00Z', read_at: null },
  { id: '2', kind: 'quote_accepted', title: 'Quote Accepted', body: 'Your quote was accepted', target_path: '/quote/2', created_at: '2023-10-02T11:00:00Z', read_at: '2023-10-02T12:00:00Z' },
  { id: '3', kind: 'work_ready', title: 'Work Ready', body: 'Your work is ready', target_path: '/job/1', created_at: '2023-10-03T12:00:00Z', read_at: null },
  { id: '4', kind: 'job_completed', title: 'Job Completed', body: 'Job completed successfully', target_path: '/job/2', created_at: '2023-10-04T13:00:00Z', read_at: '2023-10-04T14:00:00Z' },
  { id: '5', kind: 'new_message', title: 'New Message', body: 'Hello, how are you?', target_path: '/message/1', created_at: '2023-10-05T14:00:00Z', read_at: null },
  { id: '6', kind: 'vacancy_offer', title: 'Vacancy Offer', body: 'You have a new job offer', target_path: '/vacancy/1', created_at: '2023-10-06T15:00:00Z', read_at: null },
  { id: '7', kind: 'unknown_kind', title: 'Unknown Item', body: 'This is an unknown item', target_path: '/unknown/1', created_at: '2023-10-07T16:00:00Z', read_at: null },
];

test('filterInbox should correctly filter items by combined filters', () => {
  const filteredItems = filterInbox(syntheticData, 'unread', 'quotes', 'new');
  expect(filteredItems).toEqual([
    { id: '1', kind: 'new_quote', title: 'New Quote', body: 'Quote details here', target_path: '/quote/1', created_at: '2023-10-01T10:00:00Z', read_at: null }
  ]);
});

test('filterInbox should preserve order of items', () => {
  const filteredItems = filterInbox(syntheticData, 'all', 'all', '');
  expect(filteredItems.map(item => item.id)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
});

test('filterInbox should handle unknown kind gracefully', () => {
  const filteredItems = filterInbox(syntheticData, 'all', 'other', '');
  expect(filteredItems).toEqual([
    { id: '7', kind: 'unknown_kind', title: 'Unknown Item', body: 'This is an unknown item', target_path: '/unknown/1', created_at: '2023-10-07T16:00:00Z', read_at: null }
  ]);
});

test('filterInbox should be case-insensitive for search', () => {
  const filteredItems = filterInbox(syntheticData, 'all', 'all', '  NEW  ');
  expect(filteredItems.map(item => item.id)).toEqual(['1', '5', '6']);
});

test('filterInbox should not mutate the original array', () => {
  const original = structuredClone(syntheticData);
  filterInbox(syntheticData, 'all', 'all', '');
  expect(syntheticData).toEqual(original);
});

test('unreadInboxCount should return correct count', () => {
  const count = unreadInboxCount(syntheticData);
  expect(count).toBe(5);
});
