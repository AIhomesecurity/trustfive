export type SocialDraftScope = 'feed' | 'advice' | 'group';

const DRAFT_PREFIX = 'trustfive:social:draft:v1:';
const MAX_DRAFT_LENGTH = 3000;

export function buildDraftStorageKey(
  userId: string,
  scope: SocialDraftScope,
  scopeId: string
): string | null {
  const cleanUser = userId.trim();
  const cleanScopeId = scopeId.trim();
  if (!cleanUser || !cleanScopeId) return null;
  return `${DRAFT_PREFIX}${cleanUser}:${scope}:${cleanScopeId}`;
}

function getStorage(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>): Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadScopedDraft(
  userId: string,
  scope: SocialDraftScope,
  scopeId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
): string {
  const key = buildDraftStorageKey(userId, scope, scopeId);
  const store = getStorage(storage);
  if (!key || !store) return '';
  try {
    const raw = store.getItem(key);
    return typeof raw === 'string' ? raw.slice(0, MAX_DRAFT_LENGTH) : '';
  } catch {
    return '';
  }
}

export function saveScopedDraft(
  userId: string,
  scope: SocialDraftScope,
  scopeId: string,
  value: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
): void {
  const key = buildDraftStorageKey(userId, scope, scopeId);
  const store = getStorage(storage);
  if (!key || !store) return;
  try {
    if (!value) {
      store.removeItem(key);
    } else {
      store.setItem(key, value.slice(0, MAX_DRAFT_LENGTH));
    }
  } catch {
    // Ignore quota or privacy-mode storage errors; in-memory state still works.
  }
}

export function clearScopedDraft(
  userId: string,
  scope: SocialDraftScope,
  scopeId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
): void {
  saveScopedDraft(userId, scope, scopeId, '', storage);
}

/**
 * Remove any cached Social drafts belonging to a different account so a shared
 * browser session never exposes a previous user's unsent text.
 */
export function clearSocialDraftsForOtherUsers(
  activeUserId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
): void {
  const store = getStorage(storage);
  if (!store) return;
  const keepPrefix = activeUserId ? `${DRAFT_PREFIX}${activeUserId.trim()}:` : '';
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(DRAFT_PREFIX) && (!keepPrefix || !k.startsWith(keepPrefix))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) store.removeItem(k);
  } catch {
    // Ignore storage access errors.
  }
}

export function clearAllSocialDrafts(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
): void {
  clearSocialDraftsForOtherUsers('', storage);
}
