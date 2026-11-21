/** Backwards-compatible, exact-integer ISO 4217 money utilities.
 *
 * Invariants:
 * - Never use floating-point multiplication/division for money parsing or arithmetic.
 * - Never silently reinterpret legacy GBP pence (`budget_pence` / `amount_pence`) as another currency.
 * - Reject mismatched-currency arithmetic immediately; never invent FX conversion rates.
 * - Support 0-decimal (JPY), 2-decimal (GBP/USD/EUR/AUD/CAD/NZD/INR), and 3-decimal (KWD/BHD/OMR/JOD) currencies.
 */

export type TwoDecimalCurrency = 'GBP' | 'USD' | 'EUR' | 'AUD' | 'CAD' | 'NZD' | 'INR';
export type ZeroDecimalCurrency = 'JPY';
export type ThreeDecimalCurrency = 'KWD' | 'BHD' | 'OMR' | 'JOD';
export type Iso4217CurrencyCode =
  | TwoDecimalCurrency
  | ZeroDecimalCurrency
  | ThreeDecimalCurrency;

export type CurrencySpec = {
  readonly code: Iso4217CurrencyCode;
  readonly minorUnitExponent: 0 | 2 | 3;
  readonly symbol: string;
  readonly name: string;
  readonly defaultLocale: string;
};

export const CURRENCY_SPECS: Readonly<Record<Iso4217CurrencyCode, CurrencySpec>> = Object.freeze({
  GBP: Object.freeze({code: 'GBP', minorUnitExponent: 2, symbol: '£', name: 'British Pound', defaultLocale: 'en-GB'}),
  USD: Object.freeze({code: 'USD', minorUnitExponent: 2, symbol: '$', name: 'US Dollar', defaultLocale: 'en-US'}),
  EUR: Object.freeze({code: 'EUR', minorUnitExponent: 2, symbol: '€', name: 'Euro', defaultLocale: 'en-IE'}),
  AUD: Object.freeze({code: 'AUD', minorUnitExponent: 2, symbol: 'A$', name: 'Australian Dollar', defaultLocale: 'en-AU'}),
  CAD: Object.freeze({code: 'CAD', minorUnitExponent: 2, symbol: 'CA$', name: 'Canadian Dollar', defaultLocale: 'en-CA'}),
  NZD: Object.freeze({code: 'NZD', minorUnitExponent: 2, symbol: 'NZ$', name: 'New Zealand Dollar', defaultLocale: 'en-NZ'}),
  INR: Object.freeze({code: 'INR', minorUnitExponent: 2, symbol: '₹', name: 'Indian Rupee', defaultLocale: 'en-IN'}),
  JPY: Object.freeze({code: 'JPY', minorUnitExponent: 0, symbol: '¥', name: 'Japanese Yen', defaultLocale: 'ja-JP'}),
  KWD: Object.freeze({code: 'KWD', minorUnitExponent: 3, symbol: 'KWD', name: 'Kuwaiti Dinar', defaultLocale: 'en-GB'}),
  BHD: Object.freeze({code: 'BHD', minorUnitExponent: 3, symbol: 'BHD', name: 'Bahraini Dinar', defaultLocale: 'en-GB'}),
  OMR: Object.freeze({code: 'OMR', minorUnitExponent: 3, symbol: 'OMR', name: 'Omani Rial', defaultLocale: 'en-GB'}),
  JOD: Object.freeze({code: 'JOD', minorUnitExponent: 3, symbol: 'JOD', name: 'Jordanian Dinar', defaultLocale: 'en-GB'}),
});

export type Money = Readonly<{
  minorUnits: number;
  currency: Iso4217CurrencyCode;
}>;

export class MoneyCurrencyMismatchError extends Error {
  readonly leftCurrency: Iso4217CurrencyCode;
  readonly rightCurrency: Iso4217CurrencyCode;

  constructor(left: Iso4217CurrencyCode, right: Iso4217CurrencyCode) {
    super(`Cannot combine or compare mismatched currencies (${left} vs ${right}) without explicit authoritative FX conversion.`);
    this.name = 'MoneyCurrencyMismatchError';
    this.leftCurrency = left;
    this.rightCurrency = right;
  }
}

export function isSupportedCurrencyCode(value: unknown): value is Iso4217CurrencyCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CURRENCY_SPECS, value);
}

export function assertSupportedCurrency(value: unknown): Iso4217CurrencyCode {
  if (!isSupportedCurrencyCode(value)) {
    throw new Error(`Unsupported or invalid ISO 4217 currency code: ${String(value)}`);
  }
  return value;
}

export function getCurrencySpec(currency: Iso4217CurrencyCode): CurrencySpec {
  const code = assertSupportedCurrency(currency);
  return CURRENCY_SPECS[code];
}

export function createMoney(minorUnits: number, currency: Iso4217CurrencyCode): Money {
  const code = assertSupportedCurrency(currency);
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error('Money minorUnits must be a finite safe integer');
  }
  return Object.freeze({minorUnits, currency: code});
}

/** Explicitly tag legacy `budget_pence` / `amount_pence` integers as GBP.
 * Never reinterpret legacy GBP pence as another currency. */
export function fromLegacyGbpPence(pence: number): Money {
  return createMoney(pence, 'GBP');
}

export type ParseMoneyOptions = {
  allowNegative?: boolean;
  minMinorUnits?: number;
  maxMinorUnits?: number;
};

/** Parse a decimal major-unit string into exact integer minor units without floating-point math.
 * Returns null for blank/whitespace-only input. Throws on invalid format, wrong decimal places,
 * negative signs (unless allowNegative=true), or out-of-range amounts. */
export function parseMoneyInput(
  raw: string,
  currency: Iso4217CurrencyCode,
  options: ParseMoneyOptions = {}
): Money | null {
  const spec = getCurrencySpec(currency);
  const input = raw.trim();
  if (!input) return null;

  const allowNegative = Boolean(options.allowNegative);
  const signPattern = allowNegative ? '-?' : '';
  const decimalPattern =
    spec.minorUnitExponent === 0
      ? new RegExp(`^${signPattern}\\d+$`)
      : new RegExp(`^${signPattern}\\d+(?:\\.\\d{1,${spec.minorUnitExponent}})?$`);

  if (!decimalPattern.test(input)) {
    if (spec.minorUnitExponent === 0) {
      throw new Error(`Enter a valid whole-unit amount in ${spec.code} (no decimals)`);
    }
    throw new Error(
      `Enter a valid amount in ${spec.code} with up to ${spec.minorUnitExponent} decimal places`
    );
  }

  const isNegative = input.startsWith('-');
  const unsigned = isNegative ? input.slice(1) : input;
  const [wholeStr, fracStr = ''] = unsigned.split('.');
  const scale = BigInt(10 ** spec.minorUnitExponent);
  const zero = BigInt(0);
  const paddedFrac =
    spec.minorUnitExponent === 0 ? zero : BigInt(fracStr.padEnd(spec.minorUnitExponent, '0'));
  const magnitude = BigInt(wholeStr) * scale + paddedFrac;
  const signedBig = isNegative && magnitude !== zero ? -magnitude : magnitude;

  if (signedBig > BigInt(Number.MAX_SAFE_INTEGER) || signedBig < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Amount exceeds safe integer range for ${spec.code}`);
  }
  const minorUnits = Number(signedBig);

  if (typeof options.minMinorUnits === 'number' && minorUnits < options.minMinorUnits) {
    throw new Error(`Amount is below minimum allowed for ${spec.code}`);
  }
  if (typeof options.maxMinorUnits === 'number' && minorUnits > options.maxMinorUnits) {
    throw new Error(`Amount exceeds maximum allowed for ${spec.code}`);
  }

  return createMoney(minorUnits, spec.code);
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyCurrencyMismatchError(a.currency, b.currency);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const sum = BigInt(a.minorUnits) + BigInt(b.minorUnits);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Money addition overflow for ${a.currency}`);
  }
  return createMoney(Number(sum), a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const diff = BigInt(a.minorUnits) - BigInt(b.minorUnits);
  if (diff > BigInt(Number.MAX_SAFE_INTEGER) || diff < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Money subtraction overflow for ${a.currency}`);
  }
  return createMoney(Number(diff), a.currency);
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.minorUnits < b.minorUnits) return -1;
  if (a.minorUnits > b.minorUnits) return 1;
  return 0;
}

/** Exact decimal string representation of a Money value (e.g. "19.99", "1500", "12.345"). */
export function moneyToDecimalString(money: Money): string {
  const spec = getCurrencySpec(money.currency);
  if (!Number.isSafeInteger(money.minorUnits)) {
    throw new Error('Money minorUnits must be a finite safe integer');
  }
  const isNeg = money.minorUnits < 0;
  const absStr = String(Math.abs(money.minorUnits));
  if (spec.minorUnitExponent === 0) {
    return (isNeg ? '-' : '') + absStr;
  }
  const padded = absStr.padStart(spec.minorUnitExponent + 1, '0');
  const splitAt = padded.length - spec.minorUnitExponent;
  return `${isNeg ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

/** Locale-aware ISO 4217 currency formatting preserving exact currency semantics.
 * Passing another locale changes display punctuation/symbol placement only; it NEVER converts currency. */
export function formatMoney(money: Money, locale?: string): string {
  const spec = getCurrencySpec(money.currency);
  const targetLocale = locale?.trim() || spec.defaultLocale;
  const formatter = new Intl.NumberFormat(targetLocale, {
    style: 'currency',
    currency: spec.code,
    minimumFractionDigits: spec.minorUnitExponent,
    maximumFractionDigits: spec.minorUnitExponent,
  });
  // Intl.NumberFormat.format accepts a decimal string in modern Node/Chromium via Number;
  // for integers up to 1e13 minor units, exact decimal string -> Number preserves full precision.
  const decimalStr = moneyToDecimalString(money);
  return formatter.format(Number(decimalStr));
}

export function formatMoneyRange(min: Money, max: Money, locale?: string): string {
  assertSameCurrency(min, max);
  if (compareMoney(min, max) > 0) {
    throw new Error('Minimum money amount cannot exceed maximum money amount');
  }
  if (min.minorUnits === max.minorUnits) {
    return formatMoney(min, locale);
  }
  return `${formatMoney(min, locale)}–${formatMoney(max, locale)}`;
}
