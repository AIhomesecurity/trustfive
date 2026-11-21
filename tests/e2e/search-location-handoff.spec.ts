import {expect,test} from '@playwright/test';
import {
  SEARCH_LOCATION_HANDOFF_KEY,
  clearSearchLocation,
  consumeSearchLocation,
  saveSearchLocation
} from '../../lib/search-location-handoff';

// The handoff is tab-scoped and short-lived. These checks use memory storage
// only; no location is sent to a URL, analytics endpoint or provider listing.
const location = {
  label: '18 Example Street, Test City',
  latitude: 51.5,
  longitude: -0.14,
  postcode: 'SW1A 1AA',
  precision: 'address' as const,
  country: 'GB'
};

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); }
  };
}

test('Search location is saved, validated, consumed once and then cleared', () => {
  const store = memoryStore();
  saveSearchLocation(location, store);
  expect(store.getItem(SEARCH_LOCATION_HANDOFF_KEY)).toBeTruthy();
  expect(consumeSearchLocation(store)).toMatchObject(location);
  expect(consumeSearchLocation(store)).toBeNull();
});

test('Invalid, expired and malformed handoff payloads fail closed', () => {
  const expired = memoryStore({
    [SEARCH_LOCATION_HANDOFF_KEY]: JSON.stringify({ ...location, savedAt: Date.now() - 31 * 60 * 1000 })
  });
  expect(consumeSearchLocation(expired)).toBeNull();
  expect(expired.getItem(SEARCH_LOCATION_HANDOFF_KEY)).toBeNull();

  const impossible = memoryStore({
    [SEARCH_LOCATION_HANDOFF_KEY]: JSON.stringify({ ...location, latitude: 999, savedAt: Date.now() })
  });
  expect(consumeSearchLocation(impossible)).toBeNull();
  expect(impossible.getItem(SEARCH_LOCATION_HANDOFF_KEY)).toBeNull();

  const malformed = memoryStore({ [SEARCH_LOCATION_HANDOFF_KEY]: '{not json' });
  expect(consumeSearchLocation(malformed)).toBeNull();
  expect(malformed.getItem(SEARCH_LOCATION_HANDOFF_KEY)).toBeNull();
});

test('Invalid locations are never written and clear removes the handoff', () => {
  const store = memoryStore();
  saveSearchLocation({ ...location, country: 'GB!' }, store);
  expect(store.getItem(SEARCH_LOCATION_HANDOFF_KEY)).toBeNull();
  saveSearchLocation(location, store);
  clearSearchLocation(store);
  expect(consumeSearchLocation(store)).toBeNull();
});
