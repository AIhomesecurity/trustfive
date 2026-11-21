import {expect, test} from '@playwright/test';
import {
  COUNTRY_CONFIGS,
  SUPPORTED_COUNTRY_CODES,
  evaluateCountryOperationalStatus,
  formatLocalizedDate,
  formatLocalizedDateTime,
  isValidIanaTimeZone,
  listConfiguredCountries,
} from '../../lib/international/countries';
import {
  MoneyCurrencyMismatchError,
  addMoney,
  assertSupportedCurrency,
  compareMoney,
  createMoney,
  formatMoney,
  formatMoneyRange,
  fromLegacyGbpPence,
  moneyToDecimalString,
  parseMoneyInput,
  subtractMoney,
} from '../../lib/international/money';
import {
  DEFAULT_REGIONAL_PREFERENCE,
  normalizeRegionalPreference,
  preferenceForCountry,
} from '../../lib/international/preferences';
import {parseJobBudgetPence} from '../../lib/job-budget';

test.describe('International exact-integer money safety', () => {
  test('preserves GBP backwards compatibility and never reinterprets GBP pence', () => {
    const legacy = fromLegacyGbpPence(18550);
    expect(legacy).toEqual({minorUnits: 18550, currency: 'GBP'});
    expect(moneyToDecimalString(legacy)).toBe('185.50');
    expect(formatMoney(legacy, 'en-GB')).toBe('£185.50');

    // Formatting GBP under another locale keeps GBP — never converts to USD.
    const gbpInUsLocale = formatMoney(legacy, 'en-US');
    expect(gbpInUsLocale).toContain('£');
    expect(gbpInUsLocale).toContain('185.50');

    expect(parseJobBudgetPence('')).toBeNull();
    expect(parseJobBudgetPence('   ')).toBeNull();
    expect(parseJobBudgetPence('250')).toBe(25000);
    expect(parseJobBudgetPence('19.99')).toBe(1999);
    expect(parseJobBudgetPence('0.50')).toBe(50);
    expect(() => parseJobBudgetPence('-1')).toThrow(/pounds and pence/);
    expect(() => parseJobBudgetPence('10000000.01')).toThrow(/maximum allowed/);
    expect(() => parseJobBudgetPence('12.345')).toThrow(/pounds and pence/);
  });

  test('handles JPY zero-decimal currency strictly', () => {
    const yen = parseMoneyInput('1500', 'JPY');
    expect(yen).toEqual({minorUnits: 1500, currency: 'JPY'});
    expect(moneyToDecimalString(yen!)).toBe('1500');

    const formatted = formatMoney(yen!, 'ja-JP');
    expect(formatted).toContain('1,500');
    expect(formatted).not.toContain('.');

    expect(() => parseMoneyInput('1500.5', 'JPY')).toThrow(/whole-unit amount in JPY/);
    expect(() => parseMoneyInput('1500.00', 'JPY')).toThrow(/whole-unit amount in JPY/);
  });

  test('handles 3-decimal ISO 4217 currencies accurately (KWD, BHD, OMR, JOD)', () => {
    const kwd = parseMoneyInput('12.345', 'KWD');
    expect(kwd).toEqual({minorUnits: 12345, currency: 'KWD'});
    expect(moneyToDecimalString(kwd!)).toBe('12.345');

    const bhd = parseMoneyInput('0.05', 'BHD');
    expect(bhd).toEqual({minorUnits: 50, currency: 'BHD'});
    expect(moneyToDecimalString(bhd!)).toBe('0.050');

    const omr = parseMoneyInput('100.1', 'OMR');
    expect(omr).toEqual({minorUnits: 100100, currency: 'OMR'});
    expect(moneyToDecimalString(omr!)).toBe('100.100');

    const jod = parseMoneyInput('9.005', 'JOD');
    expect(jod).toEqual({minorUnits: 9005, currency: 'JOD'});
    expect(formatMoney(jod!, 'en-GB')).toContain('9.005');

    expect(() => parseMoneyInput('12.3456', 'KWD')).toThrow(/up to 3 decimal places/);
  });

  test('formats all 8 configured country locales cleanly', () => {
    expect(formatMoney(createMoney(12345678, 'GBP'), 'en-GB')).toContain('123,456.78');
    expect(formatMoney(createMoney(12345678, 'USD'), 'en-US')).toContain('123,456.78');
    expect(formatMoney(createMoney(12345678, 'EUR'), 'en-IE')).toContain('123,456.78');
    expect(formatMoney(createMoney(12345678, 'AUD'), 'en-AU')).toContain('123,456.78');
    expect(formatMoney(createMoney(12345678, 'CAD'), 'en-CA')).toContain('123,456.78');
    expect(formatMoney(createMoney(12345678, 'NZD'), 'en-NZ')).toContain('123,456.78');
    // Indian numbering system groups thousands/lakhs: 1,23,456.78
    expect(formatMoney(createMoney(12345678, 'INR'), 'en-IN')).toContain('1,23,456.78');
    expect(formatMoney(createMoney(123456, 'JPY'), 'ja-JP')).toContain('123,456');
  });

  test('handles exact arithmetic on large amounts, negative amounts and overflow rejection', () => {
    // Classic IEEE-754 traps: 0.10 + 0.20 and 19.99 * 100
    const tenP = parseMoneyInput('0.10', 'GBP')!;
    const twentyP = parseMoneyInput('0.20', 'GBP')!;
    expect(addMoney(tenP, twentyP)).toEqual({minorUnits: 30, currency: 'GBP'});

    const large = parseMoneyInput('9999999.99', 'GBP')!;
    expect(large.minorUnits).toBe(999999999);
    expect(moneyToDecimalString(large)).toBe('9999999.99');

    // Negative amounts rejected by default, permitted explicitly when opted in
    expect(() => parseMoneyInput('-25.50', 'GBP')).toThrow();
    const credit = parseMoneyInput('-25.50', 'GBP', {allowNegative: true})!;
    expect(credit.minorUnits).toBe(-2550);
    expect(moneyToDecimalString(credit)).toBe('-25.50');
    expect(subtractMoney(tenP, twentyP)).toEqual({minorUnits: -10, currency: 'GBP'});

    // Overflow beyond MAX_SAFE_INTEGER rejected
    expect(() => parseMoneyInput('999999999999999999', 'GBP')).toThrow(/safe integer range/);
    expect(() =>
      addMoney(createMoney(Number.MAX_SAFE_INTEGER, 'GBP'), createMoney(1, 'GBP'))
    ).toThrow(/overflow/);
  });

  test('validates ISO 4217 currency codes and rejects mixed-currency operations', () => {
    expect(() => assertSupportedCurrency('BTC')).toThrow(/Unsupported/);
    expect(() => assertSupportedCurrency('gbp')).toThrow(/Unsupported/);
    expect(() => assertSupportedCurrency('')).toThrow(/Unsupported/);
    expect(() => assertSupportedCurrency(null)).toThrow(/Unsupported/);

    const gbp = fromLegacyGbpPence(10000);
    const usd = createMoney(10000, 'USD');
    const jpy = createMoney(10000, 'JPY');

    expect(() => addMoney(gbp, usd)).toThrow(MoneyCurrencyMismatchError);
    expect(() => subtractMoney(gbp, jpy)).toThrow(MoneyCurrencyMismatchError);
    expect(() => compareMoney(usd, jpy)).toThrow(MoneyCurrencyMismatchError);
    expect(() => formatMoneyRange(gbp, usd, 'en-GB')).toThrow(MoneyCurrencyMismatchError);

    expect(formatMoneyRange(fromLegacyGbpPence(10000), fromLegacyGbpPence(25000), 'en-GB')).toBe(
      '£100.00–£250.00'
    );
  });
});

test.describe('Country config, DST timezones & release governance', () => {
  test('configures all 8 markets truthfully and fails closed without complete DB sign-offs', () => {
    const list = listConfiguredCountries();
    expect(list.map(c => c.countryCode)).toEqual([...SUPPORTED_COUNTRY_CODES]);

    for (const cfg of list) {
      expect(cfg.marketplaceOperationsApproved).toBe(false);
      expect(cfg.bookingsApproved).toBe(false);
      expect(cfg.requiresManualRegulatoryReview).toBe(true);

      const evaluated = evaluateCountryOperationalStatus(cfg.countryCode, null);
      expect(evaluated.configuredForDisplay).toBe(true);
      expect(evaluated.marketplaceLive).toBe(false);
      expect(evaluated.bookingsLive).toBe(false);
      expect(evaluated.blockers.length).toBeGreaterThan(0);
    }

    expect(COUNTRY_CONFIGS.GB.registrationAvailable).toBe(true);
    expect(COUNTRY_CONFIGS.US.registrationAvailable).toBe(false);
    expect(COUNTRY_CONFIGS.JP.defaultCurrency).toBe('JPY');

    // Incomplete DB gate (only 5 approvals or missing explicit owner activation) stays closed
    const missingOwnerSwitch = evaluateCountryOperationalStatus('GB', {
      countryCode: 'GB',
      reviewedTerritories: 5,
      verifiedProfessionalsWithServiceLocations: 12,
      humanApprovals: 6,
      missingApprovals: [],
      eligibleForHumanReleaseReview: true,
      ownerActivatedForLiveBookings: false,
    });
    expect(missingOwnerSwitch.bookingsLive).toBe(false);
    expect(missingOwnerSwitch.blockers.some(b => /owner production activation/i.test(b))).toBe(true);

    const missingApproval = evaluateCountryOperationalStatus('US', {
      countryCode: 'US',
      reviewedTerritories: 2,
      verifiedProfessionalsWithServiceLocations: 4,
      humanApprovals: 5,
      missingApprovals: ['legal_privacy'],
      eligibleForHumanReleaseReview: false,
      ownerActivatedForLiveBookings: true,
    });
    expect(missingApproval.bookingsLive).toBe(false);

    // Complete DB gate + explicit owner activation opens cleanly
    const approvedGate = evaluateCountryOperationalStatus('GB', {
      countryCode: 'GB',
      reviewedTerritories: 5,
      verifiedProfessionalsWithServiceLocations: 12,
      humanApprovals: 6,
      missingApprovals: [],
      eligibleForHumanReleaseReview: true,
      ownerActivatedForLiveBookings: true,
    });
    expect(approvedGate.bookingsLive).toBe(true);
    expect(approvedGate.marketplaceLive).toBe(true);
    expect(approvedGate.blockers).toEqual([]);
  });

  test('renders DST-aware appointment times across northern, southern and non-DST zones', () => {
    const winterUtc = '2026-01-15T14:30:00Z';
    const summerUtc = '2026-07-15T14:30:00Z';

    // London: GMT (14:30) in Jan -> BST (15:30) in Jul
    const lonWinter = formatLocalizedDateTime(winterUtc, 'en-GB', 'Europe/London');
    const lonSummer = formatLocalizedDateTime(summerUtc, 'en-GB', 'Europe/London');
    expect(lonWinter).toContain('14:30');
    expect(lonSummer).toContain('15:30');
    expect(lonWinter).toContain('[Europe/London]');

    // New York: EST (09:30) in Jan -> EDT (10:30) in Jul
    expect(formatLocalizedDateTime(winterUtc, 'en-US', 'America/New_York')).toContain('09:30');
    expect(formatLocalizedDateTime(summerUtc, 'en-US', 'America/New_York')).toContain('10:30');

    // Sydney (Southern Hemisphere DST): AEDT UTC+11 (01:30 next day) in Jan -> AEST UTC+10 (00:30 next day) in Jul
    expect(formatLocalizedDateTime(winterUtc, 'en-AU', 'Australia/Sydney')).toContain('01:30');
    expect(formatLocalizedDateTime(summerUtc, 'en-AU', 'Australia/Sydney')).toContain('00:30');

    // Tokyo (no DST): JST UTC+9 (23:30) in both Jan and Jul
    expect(formatLocalizedDateTime(winterUtc, 'ja-JP', 'Asia/Tokyo')).toContain('23:30');
    expect(formatLocalizedDateTime(summerUtc, 'ja-JP', 'Asia/Tokyo')).toContain('23:30');

    expect(formatLocalizedDate(winterUtc, 'en-GB', 'Europe/London')).toContain('2026');
    expect(isValidIanaTimeZone('Europe/London')).toBe(true);
    expect(isValidIanaTimeZone('Mars/Olympus_Mons')).toBe(false);
  });

  test('normalises untrusted preference payloads safely', () => {
    const normalized = normalizeRegionalPreference({
      displayCountryCode: 'INVALID',
      displayLocale: 'xx-XX',
      displayCurrency: 'FAKE',
      displayTimeZone: 'Not/A_Zone',
    });
    expect(normalized).toEqual(DEFAULT_REGIONAL_PREFERENCE);

    const jp = preferenceForCountry('JP', 'browser_session_only');
    expect(jp.displayCurrency).toBe('JPY');
    expect(jp.displayLocale).toBe('ja-JP');
    expect(jp.displayTimeZone).toBe('Asia/Tokyo');
  });
});

test.describe('Regional preferences UI (/preferences/regional)', () => {
  test('distinguishes browser session-only storage, preserves GBP quotes, and updates previews', async ({
    page,
  }) => {
    await page.goto('/preferences/regional');
    await expect(page.getByRole('heading', {level: 1, name: /region, locale & currency/i})).toBeVisible();

    // Anonymous visitor clearly sees browser session-only storage
    await expect(page.getByTestId('persistence-badge')).toContainText(
      /Browser session only \(not saved to an account\)/i
    );

    // Switch to Japan -> JPY 0-decimal preview, Tokyo timezone, GBP legacy quote fixed, bookings not approved
    await page.selectOption('#regional-country', 'JP');
    await expect(page.locator('#regional-locale')).toHaveValue('ja-JP');
    await expect(page.locator('#regional-currency')).toHaveValue('JPY');
    await expect(page.locator('#regional-timezone')).toHaveValue('Asia/Tokyo');

    await expect(page.getByTestId('preview-sample-currency')).toContainText('1,500');
    await expect(page.getByTestId('preview-sample-currency')).not.toContainText('.');
    await expect(page.getByTestId('preview-legacy-gbp')).toContainText('GBP fixed');
    await expect(page.getByTestId('preview-legacy-gbp')).toContainText('185.00');
    await expect(page.getByTestId('preview-winter-datetime')).toContainText('23:30');
    await expect(page.getByTestId('preview-country-status')).toContainText(/Bookings not yet approved/i);

    // Save to browser session and confirm reload restores Japan selection honestly as session-only
    await page.getByRole('button', {name: /save for this browser session/i}).click();
    await expect(page.getByTestId('regional-save-message')).toContainText(/browser session only/i);

    await page.reload();
    await expect(page.locator('#regional-country')).toHaveValue('JP');
    await expect(page.getByTestId('persistence-badge')).toContainText(/Browser session only/i);

    // Switch to United States -> DST shift visible in winter vs summer previews
    await page.selectOption('#regional-country', 'US');
    await expect(page.getByTestId('preview-winter-datetime')).toContainText('09:30');
    await expect(page.getByTestId('preview-summer-datetime')).toContainText('10:30');
    await expect(page.getByTestId('preview-sample-currency')).toContainText('$185.00');
    await expect(page.getByTestId('preview-legacy-gbp')).toContainText('£185.00');
    await expect(page.getByTestId('preview-country-status')).toContainText(/Bookings not yet approved/i);

    // All 8 country cards visible and truthful
    for (const code of SUPPORTED_COUNTRY_CODES) {
      await expect(page.getByTestId(`country-card-${code}`)).toBeVisible();
    }
  });

  test('renders with zero horizontal overflow and readable contrast across 320px–1280px', async ({
    page,
  }) => {
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({width, height: 844});
      await page.goto('/preferences/regional');
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();

      const metrics = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const h1Style = h1 ? window.getComputedStyle(h1) : null;
        const bodyStyle = window.getComputedStyle(document.body);
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          h1Color: h1Style?.color ?? '',
          bodyBg: bodyStyle.backgroundColor,
        };
      });

      expect(metrics.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
        metrics.innerWidth + 1
      );
      expect(metrics.h1Color).not.toBe(metrics.bodyBg);
      expect(metrics.h1Color).not.toBe('rgb(255, 255, 255)');
    }
  });
});
