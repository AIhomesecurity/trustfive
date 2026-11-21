import {
  COUNTRY_CONFIGS,
  getCountryConfig,
  isSupportedCountryCode,
  isSupportedLocale,
  isValidIanaTimeZone,
  type SupportedCountryCode,
  type SupportedLocale,
} from './countries';
import {isSupportedCurrencyCode, type Iso4217CurrencyCode} from './money';

export type RegionalDisplayPreference = Readonly<{
  displayCountryCode: SupportedCountryCode;
  displayLocale: SupportedLocale;
  displayCurrency: Iso4217CurrencyCode;
  displayTimeZone: string;
  /** Strictly identifies whether this setting came from an authorised DB row or browser session only. */
  persistence: 'account_database' | 'browser_session_only';
}>;

export const DEFAULT_REGIONAL_PREFERENCE: RegionalDisplayPreference = Object.freeze({
  displayCountryCode: 'GB',
  displayLocale: 'en-GB',
  displayCurrency: 'GBP',
  displayTimeZone: 'Europe/London',
  persistence: 'browser_session_only',
});

const SESSION_KEY = 'trustfive.regional_display_preference.v1';

/** Normalize untrusted stored or submitted preference input, falling back cleanly to safe defaults.
 * Never alters property location, active territory, or legal quote currency. */
export function normalizeRegionalPreference(
  raw: Partial<{
    displayCountryCode: unknown;
    displayLocale: unknown;
    displayCurrency: unknown;
    displayTimeZone: unknown;
  }> | null | undefined,
  persistence: 'account_database' | 'browser_session_only' = 'browser_session_only'
): RegionalDisplayPreference {
  const countryCode: SupportedCountryCode =
    typeof raw?.displayCountryCode === 'string' && isSupportedCountryCode(raw.displayCountryCode)
      ? (raw.displayCountryCode.toUpperCase() as SupportedCountryCode)
      : 'GB';
  const country = COUNTRY_CONFIGS[countryCode];

  const displayLocale: SupportedLocale = isSupportedLocale(raw?.displayLocale)
    ? raw.displayLocale
    : country.defaultLocale;

  const displayCurrency: Iso4217CurrencyCode = isSupportedCurrencyCode(raw?.displayCurrency)
    ? raw.displayCurrency
    : country.defaultCurrency;

  const displayTimeZone =
    typeof raw?.displayTimeZone === 'string' && isValidIanaTimeZone(raw.displayTimeZone)
      ? raw.displayTimeZone.trim()
      : country.defaultTimeZone;

  return Object.freeze({
    displayCountryCode: countryCode,
    displayLocale,
    displayCurrency,
    displayTimeZone,
    persistence,
  });
}

export function preferenceForCountry(
  countryCode: SupportedCountryCode,
  persistence: 'account_database' | 'browser_session_only' = 'browser_session_only'
): RegionalDisplayPreference {
  const cfg = getCountryConfig(countryCode) || COUNTRY_CONFIGS.GB;
  return Object.freeze({
    displayCountryCode: cfg.countryCode,
    displayLocale: cfg.defaultLocale,
    displayCurrency: cfg.defaultCurrency,
    displayTimeZone: cfg.defaultTimeZone,
    persistence,
  });
}

export function readSessionRegionalPreference(): RegionalDisplayPreference {
  if (typeof window === 'undefined') return DEFAULT_REGIONAL_PREFERENCE;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return DEFAULT_REGIONAL_PREFERENCE;
    return normalizeRegionalPreference(JSON.parse(raw), 'browser_session_only');
  } catch {
    return DEFAULT_REGIONAL_PREFERENCE;
  }
}

export function writeSessionRegionalPreference(
  pref: RegionalDisplayPreference
): RegionalDisplayPreference {
  const normalized = normalizeRegionalPreference(pref, 'browser_session_only');
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore private-browsing storage quota errors; in-memory state still works.
    }
  }
  return normalized;
}
