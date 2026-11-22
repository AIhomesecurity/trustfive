'use client';

import {FormEvent, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '@/lib/supabase';
import {
  COUNTRY_CONFIGS,
  SUPPORTED_LOCALES,
  evaluateCountryOperationalStatus,
  formatLocalizedDateTime,
  listConfiguredCountries,
  type SupportedCountryCode,
  type SupportedLocale,
} from '@/lib/international/countries';
import {
  CURRENCY_SPECS,
  createMoney,
  formatMoney,
  fromLegacyGbpPence,
  type Iso4217CurrencyCode,
} from '@/lib/international/money';
import {
  DEFAULT_REGIONAL_PREFERENCE,
  normalizeRegionalPreference,
  preferenceForCountry,
  readSessionRegionalPreference,
  writeSessionRegionalPreference,
  type RegionalDisplayPreference,
} from '@/lib/international/preferences';

const DISPLAY_CURRENCIES: readonly Iso4217CurrencyCode[] = [
  'GBP',
  'USD',
  'EUR',
  'AUD',
  'CAD',
  'NZD',
  'INR',
  'JPY',
];

const CURATED_TIMEZONES: readonly {zone: string; label: string}[] = [
  {zone: 'Europe/London', label: 'Europe/London (UK — GMT / BST)'},
  {zone: 'Europe/Dublin', label: 'Europe/Dublin (Ireland — GMT / IST)'},
  {zone: 'America/New_York', label: 'America/New_York (US Eastern — EST / EDT)'},
  {zone: 'America/Chicago', label: 'America/Chicago (US Central — CST / CDT)'},
  {zone: 'America/Los_Angeles', label: 'America/Los_Angeles (US Pacific — PST / PDT)'},
  {zone: 'America/Toronto', label: 'America/Toronto (Canada Eastern — EST / EDT)'},
  {zone: 'America/Vancouver', label: 'America/Vancouver (Canada Pacific — PST / PDT)'},
  {zone: 'Australia/Sydney', label: 'Australia/Sydney (Australia Eastern — AEST / AEDT)'},
  {zone: 'Australia/Perth', label: 'Australia/Perth (Australia Western — AWST)'},
  {zone: 'Pacific/Auckland', label: 'Pacific/Auckland (New Zealand — NZST / NZDT)'},
  {zone: 'Asia/Kolkata', label: 'Asia/Kolkata (India — IST)'},
  {zone: 'Asia/Tokyo', label: 'Asia/Tokyo (Japan — JST)'},
  {zone: 'UTC', label: 'UTC (Coordinated Universal Time)'},
];

const WINTER_SAMPLE_ISO = '2026-01-15T14:30:00Z';
const SUMMER_SAMPLE_ISO = '2026-07-15T14:30:00Z';

function formatAddressSupport(mode: string): string {
  if (mode === 'postcodes_io_and_geoapify') return 'UK postcode lookup (Postcodes.io / optional Geoapify)';
  if (mode === 'geoapify_optional') return 'Optional Geoapify lookup';
  return 'Manual address entry only';
}

export default function RegionalPreferencesPage() {
  const [pref, setPref] = useState<RegionalDisplayPreference>(DEFAULT_REGIONAL_PREFERENCE);
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const countries = useMemo(() => listConfiguredCountries(), []);

  useEffect(() => {
    let active = true;
    const sessionPref = readSessionRegionalPreference();
    setPref(sessionPref);

    async function hydrateFromAccount() {
      try {
        const supabase = supabaseBrowser();
        const {data: authData} = await supabase.auth.getUser();
        const user = authData?.user ?? null;
        if (!active) return;
        setSignedInUserId(user ? user.id : null);

        if (user) {
          const {data: row, error} = await supabase
            .from('user_regional_preferences')
            .select('display_country_code, display_locale, display_currency, display_timezone')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!active) return;
          if (!error && row) {
            setPref(
              normalizeRegionalPreference(
                {
                  displayCountryCode: row.display_country_code,
                  displayLocale: row.display_locale,
                  displayCurrency: row.display_currency,
                  displayTimeZone: row.display_timezone,
                },
                'account_database'
              )
            );
          }
        }
      } catch {
        // Offline or unconfigured environment cleanly stays in browser session-only mode.
      } finally {
        if (active) setAuthChecked(true);
      }
    }

    void hydrateFromAccount();
    return () => {
      active = false;
    };
  }, []);

  const selectedCountry = COUNTRY_CONFIGS[pref.displayCountryCode];
  const selectedStatus = useMemo(
    () => evaluateCountryOperationalStatus(pref.displayCountryCode, null),
    [pref.displayCountryCode]
  );

  const selectedCurrencySpec = CURRENCY_SPECS[pref.displayCurrency];
  const legacyUkQuote = useMemo(() => fromLegacyGbpPence(18500), []);
  const sampleLocalMoney = useMemo(() => {
    const sampleMinorUnits =
      selectedCurrencySpec.minorUnitExponent === 0
        ? 1500
        : selectedCurrencySpec.minorUnitExponent === 3
          ? 185000
          : 18500;
    return createMoney(sampleMinorUnits, pref.displayCurrency);
  }, [pref.displayCurrency, selectedCurrencySpec.minorUnitExponent]);

  const legacyQuoteFormatted = useMemo(
    () => formatMoney(legacyUkQuote, pref.displayLocale),
    [legacyUkQuote, pref.displayLocale]
  );
  const sampleLocalFormatted = useMemo(
    () => formatMoney(sampleLocalMoney, pref.displayLocale),
    [sampleLocalMoney, pref.displayLocale]
  );
  const winterPreview = useMemo(
    () => formatLocalizedDateTime(WINTER_SAMPLE_ISO, pref.displayLocale, pref.displayTimeZone),
    [pref.displayLocale, pref.displayTimeZone]
  );
  const summerPreview = useMemo(
    () => formatLocalizedDateTime(SUMMER_SAMPLE_ISO, pref.displayLocale, pref.displayTimeZone),
    [pref.displayLocale, pref.displayTimeZone]
  );

  function handleCountryChange(countryCode: SupportedCountryCode) {
    setStatusMessage(null);
    setErrorMessage(null);
    setPref(preferenceForCountry(countryCode, pref.persistence));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      if (signedInUserId) {
        const supabase = supabaseBrowser();
        const {data, error} = await supabase.rpc('save_my_regional_preferences', {
          p_country: pref.displayCountryCode,
          p_locale: pref.displayLocale,
          p_currency: pref.displayCurrency,
          p_timezone: pref.displayTimeZone,
        });

        if (!error && data) {
          const saved = normalizeRegionalPreference(
            {
              displayCountryCode: data.display_country_code,
              displayLocale: data.display_locale,
              displayCurrency: data.display_currency,
              displayTimeZone: data.display_timezone,
            },
            'account_database'
          );
          writeSessionRegionalPreference(saved);
          setPref(saved);
          setStatusMessage(
            'Saved to your TrustFive account. These settings control display formatting only and never alter property location, territory approval, or legal quote currency.'
          );
          return;
        }

        const sessionSaved = writeSessionRegionalPreference(pref);
        setPref(sessionSaved);
        setErrorMessage(
          'Your account database could not persist this setting right now, so it has been stored for this browser session only.'
        );
        return;
      }

      const sessionSaved = writeSessionRegionalPreference(pref);
      setPref(sessionSaved);
      setStatusMessage(
        'Saved for this browser session only (not saved to an account). Sign in if you want TrustFive to store display preferences on your account.'
      );
    } catch {
      const sessionSaved = writeSessionRegionalPreference(pref);
      setPref(sessionSaved);
      setErrorMessage(
        'Saved for this browser session only. Account persistence was unavailable.'
      );
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    setStatusMessage(null);
    setErrorMessage(null);
    const reset = writeSessionRegionalPreference(DEFAULT_REGIONAL_PREFERENCE);
    setPref(reset);
    setStatusMessage('Reset to United Kingdom display defaults (en-GB, GBP, Europe/London) for this browser session.');
  }

  const persistenceLabel =
    pref.persistence === 'account_database'
      ? 'Saved to your TrustFive account'
      : 'Browser session only (not saved to an account)';

  return (
    <main className="container" style={{paddingBottom: 56}}>
      <div className="page-heading">
        <p className="eyebrow">International display settings</p>
        <h1>Region, locale &amp; currency preferences</h1>
        <p className="subtle">
          Choose how TrustFive formats dates, times and sample currency examples in your browser.
          Display preferences never change your real property or business location, never convert
          legal quote currencies, and never unlock unapproved countries.
        </p>
      </div>

      <div
        className="notice"
        role="status"
        data-testid="persistence-status"
        style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12}}
      >
        <div>
          <strong>Storage mode:</strong>{' '}
          <span className="pill" data-testid="persistence-badge">
            {persistenceLabel}
          </span>
          {!signedInUserId && authChecked ? (
            <p className="muted-note" style={{margin: '6px 0 0'}}>
              You are browsing without a signed-in account. Changes stay in this browser tab session
              only.{' '}
              <Link href="/account" style={{color: 'var(--green)', textDecoration: 'underline', fontWeight: 700}}>
                Sign in or join
              </Link>{' '}
              to save preferences to your TrustFive account.
            </p>
          ) : null}
        </div>
      </div>

      <div className="two-col" style={{alignItems: 'start', marginTop: 20}}>
        <section className="card" aria-labelledby="regional-form-heading">
          <h2 id="regional-form-heading" style={{marginTop: 0, fontSize: 22}}>
            Display formatting preferences
          </h2>
          <p className="muted-note" style={{marginBottom: 18}}>
            Selecting a country updates the suggested locale, currency example and timezone below.
            You may override any field individually.
          </p>

          <form className="form" onSubmit={handleSave}>
            <label htmlFor="regional-country">
              Display country (preview only)
              <select
                id="regional-country"
                name="displayCountryCode"
                value={pref.displayCountryCode}
                onChange={event => handleCountryChange(event.target.value as SupportedCountryCode)}
              >
                {countries.map(country => (
                  <option key={country.countryCode} value={country.countryCode}>
                    {country.name} ({country.countryCode}) — {country.defaultCurrency}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid">
              <label htmlFor="regional-locale">
                Locale &amp; number formatting
                <select
                  id="regional-locale"
                  name="displayLocale"
                  value={pref.displayLocale}
                  onChange={event => {
                    setStatusMessage(null);
                    setPref(current =>
                      normalizeRegionalPreference(
                        {...current, displayLocale: event.target.value as SupportedLocale},
                        current.persistence
                      )
                    );
                  }}
                >
                  {SUPPORTED_LOCALES.map(locale => (
                    <option key={locale} value={locale}>
                      {locale}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="regional-currency">
                Display currency example
                <select
                  id="regional-currency"
                  name="displayCurrency"
                  value={pref.displayCurrency}
                  onChange={event => {
                    setStatusMessage(null);
                    setPref(current =>
                      normalizeRegionalPreference(
                        {...current, displayCurrency: event.target.value as Iso4217CurrencyCode},
                        current.persistence
                      )
                    );
                  }}
                >
                  {DISPLAY_CURRENCIES.map(code => {
                    const spec = CURRENCY_SPECS[code];
                    return (
                      <option key={code} value={code}>
                        {spec.code} — {spec.name} ({spec.minorUnitExponent} decimals)
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <label htmlFor="regional-timezone">
              Timezone (IANA, DST-aware)
              <select
                id="regional-timezone"
                name="displayTimeZone"
                value={pref.displayTimeZone}
                onChange={event => {
                  setStatusMessage(null);
                  setPref(current =>
                    normalizeRegionalPreference(
                      {...current, displayTimeZone: event.target.value},
                      current.persistence
                    )
                  );
                }}
              >
                {CURATED_TIMEZONES.map(item => (
                  <option key={item.zone} value={item.zone}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4}}>
              <button className="btn" type="submit" disabled={saving}>
                {saving
                  ? 'Saving…'
                  : signedInUserId
                    ? 'Save to account'
                    : 'Save for this browser session'}
              </button>
              <button className="btn secondary" type="button" onClick={handleResetDefaults}>
                Reset to UK defaults
              </button>
            </div>

            {statusMessage ? (
              <div className="notice" role="status" data-testid="regional-save-message">
                {statusMessage}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="notice error" role="alert" data-testid="regional-error-message">
                {errorMessage}
              </div>
            ) : null}
          </form>
        </section>

        <section
          className="card"
          aria-labelledby="regional-preview-heading"
          data-testid="regional-live-preview"
        >
          <h2 id="regional-preview-heading" style={{marginTop: 0, fontSize: 22}}>
            Live formatting preview
          </h2>
          <p className="muted-note" style={{marginBottom: 16}}>
            Verify how exact minor-unit amounts and daylight-saving appointment times render under
            your chosen settings.
          </p>

          <dl style={{display: 'grid', gap: 14, margin: 0}}>
            <div style={{borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <dt className="muted-note">Existing UK quote (legal currency stays GBP — never converted)</dt>
              <dd
                data-testid="preview-legacy-gbp"
                style={{margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: 'var(--dark)'}}
              >
                {legacyQuoteFormatted}{' '}
                <span className="pill" style={{verticalAlign: 'middle', marginLeft: 6}}>
                  GBP fixed
                </span>
              </dd>
            </div>

            <div style={{borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <dt className="muted-note">
                Example formatting in {selectedCurrencySpec.code} ({selectedCurrencySpec.minorUnitExponent}{' '}
                decimal places)
              </dt>
              <dd
                data-testid="preview-sample-currency"
                style={{margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: 'var(--green)'}}
              >
                {sampleLocalFormatted}
              </dd>
            </div>

            <div style={{borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <dt className="muted-note">Winter appointment (2026-01-15 14:30 UTC)</dt>
              <dd
                data-testid="preview-winter-datetime"
                style={{margin: '4px 0 0', fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere'}}
              >
                {winterPreview}
              </dd>
            </div>

            <div style={{borderBottom: '1px solid var(--border)', paddingBottom: 12}}>
              <dt className="muted-note">Summer appointment (2026-07-15 14:30 UTC)</dt>
              <dd
                data-testid="preview-summer-datetime"
                style={{margin: '4px 0 0', fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere'}}
              >
                {summerPreview}
              </dd>
            </div>

            <div>
              <dt className="muted-note">Selected country operational status ({selectedCountry.name})</dt>
              <dd
                data-testid="preview-country-status"
                style={{margin: '6px 0 0', fontSize: 14, color: 'var(--dark)'}}
              >
                <span className="pill" style={{marginBottom: 6}}>
                  {selectedStatus.bookingsLive
                    ? 'Bookings approved'
                    : 'Bookings not yet approved'}
                </span>
                <p style={{margin: '6px 0 0', fontSize: 13, color: 'var(--muted)'}}>
                  {selectedCountry.statusSummary}
                </p>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card" style={{marginTop: 24}} aria-labelledby="truthful-boundaries-heading">
        <h2 id="truthful-boundaries-heading" style={{marginTop: 0, fontSize: 20}}>
          What these settings do — and do not do
        </h2>
        <div className="how-grid" style={{marginTop: 14}}>
          <div className="how-step" style={{padding: 18}}>
            <span className="eyebrow" style={{display: 'block', marginBottom: 6}}>1. Location integrity</span>
            <h3 style={{fontSize: 17, margin: '0 0 6px'}}>Does not move your property or business</h3>
            <p style={{fontSize: 14}}>
              Your job postcode and a professional&apos;s verified service territory are stored
              separately and audited independently. Changing display country never alters search
              geography or five-slot eligibility.
            </p>
          </div>
          <div className="how-step" style={{padding: 18}}>
            <span className="eyebrow" style={{display: 'block', marginBottom: 6}}>2. Exact money safety</span>
            <h3 style={{fontSize: 17, margin: '0 0 6px'}}>No invented exchange-rate conversions</h3>
            <p style={{fontSize: 14}}>
              Quotes, job budgets and receipts are stored as exact integer minor units in their
              native ISO 4217 currency. Legacy UK figures remain strictly in GBP rather than being
              relabelled or estimated in another currency.
            </p>
          </div>
          <div className="how-step" style={{padding: 18}}>
            <span className="eyebrow" style={{display: 'block', marginBottom: 6}}>3. Release governance</span>
            <h3 style={{fontSize: 17, margin: '0 0 6px'}}>Country release sign-offs stay mandatory</h3>
            <p style={{fontSize: 14}}>
              Every country requires independently reviewed territories, vetted local professionals,
              all six human release approvals and explicit owner activation before bookings open.
            </p>
          </div>
        </div>
      </section>

      <section style={{marginTop: 32}} aria-labelledby="configured-countries-heading">
        <div style={{marginBottom: 16}}>
          <p className="eyebrow" style={{marginBottom: 6}}>Configured display markets</p>
          <h2 id="configured-countries-heading" style={{margin: 0, fontSize: 26}}>
            Regional capability &amp; release status
          </h2>
          <p className="subtle" style={{margin: '6px 0 0'}}>
            Transparent separation between display formatting, address lookup capability and
            independent country release approval.
          </p>
        </div>

        <div className="grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'}}>
          {countries.map(country => {
            const evalStatus = evaluateCountryOperationalStatus(country.countryCode, null);
            const spec = CURRENCY_SPECS[country.defaultCurrency];
            return (
              <article
                key={country.countryCode}
                className="card"
                data-testid={`country-card-${country.countryCode}`}
                style={{display: 'flex', flexDirection: 'column', gap: 8}}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                  <h3 style={{margin: 0, fontSize: 18}}>
                    {country.name} ({country.countryCode})
                  </h3>
                  <span className="pill">{country.defaultCurrency}</span>
                </div>
                <p style={{fontSize: 13}}>
                  <strong>Locale:</strong> {country.defaultLocale} · <strong>Decimals:</strong>{' '}
                  {spec.minorUnitExponent} · <strong>Postal label:</strong> {country.postalCodeLabel}
                </p>
                <p style={{fontSize: 13}}>
                  <strong>Timezone:</strong> {country.defaultTimeZone}
                </p>
                <p style={{fontSize: 13}}>
                  <strong>Registration / interest:</strong>{' '}
                  {country.registrationAvailable ? 'UK interest & accounts open' : 'Not yet open'}
                </p>
                <p style={{fontSize: 13}}>
                  <strong>Address lookup:</strong> {formatAddressSupport(country.addressLookupSupport)}
                </p>
                <p style={{fontSize: 13, color: 'var(--dark)', fontWeight: 700, marginTop: 'auto', paddingTop: 6}}>
                  Bookings: {evalStatus.bookingsLive ? 'Approved' : 'Not yet approved (manual review required)'}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
