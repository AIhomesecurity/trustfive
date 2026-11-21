import type {Iso4217CurrencyCode} from './money';

/** Strongly typed international country & regional configuration.
 *
 * CRITICAL INVARIANT:
 * Static regional formatting configurations NEVER imply operational marketplace launch,
 * booking availability, or active five-slot coverage. Operational launch requires
 * authoritative database release sign-offs (`country_release_signoffs` + reviewed
 * territories + independently vetted active professionals).
 */

export type SupportedCountryCode = 'GB' | 'US' | 'IE' | 'AU' | 'CA' | 'NZ' | 'IN' | 'JP';
export type SupportedLocale =
  | 'en-GB'
  | 'en-US'
  | 'en-IE'
  | 'en-AU'
  | 'en-CA'
  | 'en-NZ'
  | 'en-IN'
  | 'ja-JP';

export type AddressLookupSupport =
  | 'postcodes_io_and_geoapify'
  | 'geoapify_optional'
  | 'manual_only';

export type CountryRegionalConfig = Readonly<{
  countryCode: SupportedCountryCode;
  name: string;
  defaultCurrency: Iso4217CurrencyCode;
  defaultLocale: SupportedLocale;
  defaultTimeZone: string;
  postalCodeLabel: string;
  measurementUnit: 'km' | 'mi';
  /** Whether residents may register an account / express interest. */
  registrationAvailable: boolean;
  /** Address/postcode lookup integration capability. */
  addressLookupSupport: AddressLookupSupport;
  /** Static config NEVER claims operational marketplace launch without DB release gates. */
  marketplaceOperationsApproved: false;
  /** Static config NEVER claims live booking approval without DB release gates. */
  bookingsApproved: false;
  /** Independent human legal, privacy, vetting & regulatory review required before launch. */
  requiresManualRegulatoryReview: true;
  /** Honest status explanation shown in UI. */
  statusSummary: string;
}>;

export const COUNTRY_CONFIGS: Readonly<Record<SupportedCountryCode, CountryRegionalConfig>> =
  Object.freeze({
    GB: Object.freeze({
      countryCode: 'GB',
      name: 'United Kingdom',
      defaultCurrency: 'GBP',
      defaultLocale: 'en-GB',
      defaultTimeZone: 'Europe/London',
      postalCodeLabel: 'Postcode',
      measurementUnit: 'mi',
      registrationAvailable: true,
      addressLookupSupport: 'postcodes_io_and_geoapify',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'UK postcode search and pending coverage requests are available; active five-slot territories open only after independent boundary, vetting and country release sign-offs.',
    }),
    US: Object.freeze({
      countryCode: 'US',
      name: 'United States',
      defaultCurrency: 'USD',
      defaultLocale: 'en-US',
      defaultTimeZone: 'America/New_York',
      postalCodeLabel: 'ZIP code',
      measurementUnit: 'mi',
      registrationAvailable: false,
      addressLookupSupport: 'manual_only',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'Display formatting configured only. Marketplace operations, bookings and US territory vetting are not yet approved.',
    }),
    IE: Object.freeze({
      countryCode: 'IE',
      name: 'Ireland',
      defaultCurrency: 'EUR',
      defaultLocale: 'en-IE',
      defaultTimeZone: 'Europe/Dublin',
      postalCodeLabel: 'Eircode',
      measurementUnit: 'km',
      registrationAvailable: false,
      addressLookupSupport: 'manual_only',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'Display formatting configured only. Marketplace operations, bookings and Ireland territory vetting are not yet approved.',
    }),
    AU: Object.freeze({
      countryCode: 'AU',
      name: 'Australia',
      defaultCurrency: 'AUD',
      defaultLocale: 'en-AU',
      defaultTimeZone: 'Australia/Sydney',
      postalCodeLabel: 'Postcode',
      measurementUnit: 'km',
      registrationAvailable: false,
      addressLookupSupport: 'manual_only',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'Display formatting configured only. Marketplace operations, bookings and Australia territory vetting are not yet approved.',
    }),
    CA: Object.freeze({
      countryCode: 'CA',
      name: 'Canada',
      defaultCurrency: 'CAD',
      defaultLocale: 'en-CA',
      defaultTimeZone: 'America/Toronto',
      postalCodeLabel: 'Postal code',
      measurementUnit: 'km',
      registrationAvailable: false,
      addressLookupSupport: 'manual_only',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'Display formatting configured only. Marketplace operations, bookings and Canada territory vetting are not yet approved.',
    }),
    NZ: Object.freeze({
      countryCode: 'NZ',
      name: 'New Zealand',
      defaultCurrency: 'NZD',
      defaultLocale: 'en-NZ',
      defaultTimeZone: 'Pacific/Auckland',
      postalCodeLabel: 'Postcode',
      measurementUnit: 'km',
      registrationAvailable: false,
      addressLookupSupport: 'manual_only',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'Display formatting configured only. Marketplace operations, bookings and New Zealand territory vetting are not yet approved.',
    }),
    IN: Object.freeze({
      countryCode: 'IN',
      name: 'India',
      defaultCurrency: 'INR',
      defaultLocale: 'en-IN',
      defaultTimeZone: 'Asia/Kolkata',
      postalCodeLabel: 'PIN code',
      measurementUnit: 'km',
      registrationAvailable: false,
      addressLookupSupport: 'manual_only',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'Display formatting configured only. Marketplace operations, bookings and India territory vetting are not yet approved.',
    }),
    JP: Object.freeze({
      countryCode: 'JP',
      name: 'Japan',
      defaultCurrency: 'JPY',
      defaultLocale: 'ja-JP',
      defaultTimeZone: 'Asia/Tokyo',
      postalCodeLabel: 'Postal code',
      measurementUnit: 'km',
      registrationAvailable: false,
      addressLookupSupport: 'manual_only',
      marketplaceOperationsApproved: false,
      bookingsApproved: false,
      requiresManualRegulatoryReview: true,
      statusSummary:
        'Display formatting configured only. Marketplace operations, bookings and Japan territory vetting are not yet approved.',
    }),
  });

export const SUPPORTED_COUNTRY_CODES: readonly SupportedCountryCode[] = Object.freeze([
  'GB',
  'US',
  'IE',
  'AU',
  'CA',
  'NZ',
  'IN',
  'JP',
]);

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = Object.freeze([
  'en-GB',
  'en-US',
  'en-IE',
  'en-AU',
  'en-CA',
  'en-NZ',
  'en-IN',
  'ja-JP',
]);

export function isSupportedCountryCode(value: unknown): value is SupportedCountryCode {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(COUNTRY_CONFIGS, value.toUpperCase())
  );
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getCountryConfig(code: string | null | undefined): CountryRegionalConfig | null {
  if (typeof code !== 'string') return null;
  const upper = code.trim().toUpperCase();
  if (!isSupportedCountryCode(upper)) return null;
  return COUNTRY_CONFIGS[upper];
}

export function listConfiguredCountries(): readonly CountryRegionalConfig[] {
  return SUPPORTED_COUNTRY_CODES.map(code => COUNTRY_CONFIGS[code]);
}

/** Authoritative DB release-gate snapshot (mirrors trustfive_admin_country_release_gate). */
export type AuthoritativeCountryReleaseGate = {
  countryCode: string;
  reviewedTerritories: number;
  verifiedProfessionalsWithServiceLocations: number;
  humanApprovals: number;
  missingApprovals: string[];
  eligibleForHumanReleaseReview: boolean;
  /** Explicit owner production switch — never inferred automatically. */
  ownerActivatedForLiveBookings?: boolean;
};

export type CountryOperationalEvaluation = {
  countryCode: string;
  configuredForDisplay: boolean;
  registrationAvailable: boolean;
  addressLookupAvailable: boolean;
  marketplaceLive: boolean;
  bookingsLive: boolean;
  requiresManualRegulatoryReview: boolean;
  blockers: string[];
};

/** Combine static regional config with authoritative DB release evidence.
 * Fails closed: no country is ever marked live for marketplace or bookings without
 * reviewed territories, vetted professionals, all 6 human release approvals, and
 * explicit owner activation. */
export function evaluateCountryOperationalStatus(
  countryCode: string,
  gate?: AuthoritativeCountryReleaseGate | null
): CountryOperationalEvaluation {
  const config = getCountryConfig(countryCode);
  const normalized = countryCode.trim().toUpperCase();
  if (!config) {
    return {
      countryCode: normalized,
      configuredForDisplay: false,
      registrationAvailable: false,
      addressLookupAvailable: false,
      marketplaceLive: false,
      bookingsLive: false,
      requiresManualRegulatoryReview: true,
      blockers: ['Country is not configured in TrustFive regional settings.'],
    };
  }

  const blockers: string[] = [];
  if (!gate) {
    blockers.push('No authoritative database country release sign-off record supplied.');
  } else {
    if (gate.countryCode.toUpperCase() !== config.countryCode) {
      blockers.push('Release gate country code does not match requested country.');
    }
    if (gate.reviewedTerritories <= 0) {
      blockers.push('No independently reviewed territory boundaries exist for this country.');
    }
    if (gate.verifiedProfessionalsWithServiceLocations <= 0) {
      blockers.push('No independently vetted active professionals with verified coverage exist.');
    }
    if (gate.humanApprovals < 6 || gate.missingApprovals.length > 0) {
      blockers.push(
        `Missing required human release approvals (${gate.missingApprovals.join(', ') || 'incomplete'}).`
      );
    }
    if (!gate.eligibleForHumanReleaseReview) {
      blockers.push('Country has not met eligibility criteria for human release review.');
    }
    if (!gate.ownerActivatedForLiveBookings) {
      blockers.push('Explicit owner production activation is still required.');
    }
  }

  const live = blockers.length === 0;
  return {
    countryCode: config.countryCode,
    configuredForDisplay: true,
    registrationAvailable: config.registrationAvailable,
    addressLookupAvailable: config.addressLookupSupport !== 'manual_only',
    marketplaceLive: live,
    bookingsLive: live,
    requiresManualRegulatoryReview: !live,
    blockers,
  };
}

export function isValidIanaTimeZone(zone: string): boolean {
  const clean = zone.trim();
  if (clean.length < 3 || clean.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-GB', {timeZone: clean});
    return true;
  } catch {
    return false;
  }
}

/** DST-safe, locale- and IANA-timezone-aware date formatting. */
export function formatLocalizedDate(
  isoDate: string,
  locale: string,
  timeZone: string
): string {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  const safeZone = isValidIanaTimeZone(timeZone) ? timeZone.trim() : 'UTC';
  const safeLocale = isSupportedLocale(locale) ? locale : 'en-GB';
  return new Intl.DateTimeFormat(safeLocale, {
    timeZone: safeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** DST-safe, locale- and IANA-timezone-aware date+time formatting with explicit timezone name. */
export function formatLocalizedDateTime(
  isoDate: string,
  locale: string,
  timeZone: string
): string {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  const safeZone = isValidIanaTimeZone(timeZone) ? timeZone.trim() : 'UTC';
  const safeLocale = isSupportedLocale(locale) ? locale : 'en-GB';
  const formatted = new Intl.DateTimeFormat(safeLocale, {
    timeZone: safeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date);
  return `${formatted} [${safeZone}]`;
}
