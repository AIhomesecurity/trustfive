export type OAuthProviderKey = 'google' | 'apple';

export type OAuthProviderAvailability = {
  google: boolean;
  apple: boolean;
  checked: boolean;
};

export function parseAuthSettingsProviders(payload: unknown): OAuthProviderAvailability {
  const ext =
    payload && typeof payload === 'object' && 'external' in payload
      ? (payload as {external?: Record<string, unknown>}).external
      : null;
  if (!ext || typeof ext !== 'object') {
    return {google: false, apple: false, checked: false};
  }
  return {
    google: ext.google === true,
    apple: ext.apple === true,
    checked: true,
  };
}

export async function fetchEnabledOAuthProviders(
  supabaseUrl: string | undefined,
  publishableKey: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<OAuthProviderAvailability> {
  const base = (supabaseUrl ?? '').trim().replace(/\/+$/, '');
  const key = (publishableKey ?? '').trim();
  if (!base || !key) return {google: false, apple: false, checked: false};

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
  try {
    const res = await fetchImpl(`${base}/auth/v1/settings`, {
      method: 'GET',
      headers: {apikey: key, accept: 'application/json'},
      signal: controller?.signal,
    });
    if (!res.ok) return {google: false, apple: false, checked: false};
    const json = await res.json();
    return parseAuthSettingsProviders(json);
  } catch {
    return {google: false, apple: false, checked: false};
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function safeAuthCallbackError(search: string): string {
  const params = new URLSearchParams(search);
  const authError = (params.get('auth_error') ?? '').trim();
  if (authError === 'provider_disabled') {
    return 'Social sign-in is not enabled on this environment yet. Please use email and password above.';
  }
  if (authError === 'callback_failed') {
    return 'Could not complete sign-in with your provider. Please try again or sign in with email and password.';
  }
  return '';
}
