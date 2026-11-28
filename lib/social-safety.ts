export const ALLOWED_SOCIAL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_SOCIAL_IMAGE_BYTES = 5 * 1024 * 1024;

export type SocialMediaCheckResult =
  | {ok: true; mimeType: (typeof ALLOWED_SOCIAL_IMAGE_TYPES)[number]; sizeBytes: number; stripMetadata: true; summary: string}
  | {ok: false; reason: string};

export type SocialPostSafetyAssessment = {
  blockingError: string | null;
  privacyWarnings: string[];
};

const URL_OR_DOMAIN_RE =
  /(?:https?\s*:|www\.|[a-z0-9-]+\.(?:co\.uk|org\.uk|gov\.uk|ac\.uk|com|net|org|uk|me|io|info|biz|shop|app)\b|wa\.me\/|t\.me\/|linktr\.ee\/)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|@/i;
const MESSAGING_APP_RE =
  /\b(?:whats[\s-]*app|telegram|signal\s+(?:me|on)|dm\s+me\s+on\s+(?:insta|facebook|fb))\b/i;
const REPEATED_CHAR_RE = /(\S)\1{11,}/;
const UK_FULL_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const UK_PHONE_RE = /(?:\+44\s?7\d{3}|\b07\d{3}|\b0[1238]\d{2,3})[\s.-]?\d{3}[\s.-]?\d{3,4}\b/;
const GENERIC_PHONE_DIGITS_RE = /(?:\d[\s.()+/-]*){7,}/;
const SPELLED_DIGITS_RE =
  /(?:\b(?:zero|oh|nought|one|two|three|four|five|six|seven|eight|nine|\d)\b[^a-z0-9]+){6}\b(?:zero|oh|nought|one|two|three|four|five|six|seven|eight|nine|\d)\b/i;

const CONTACT_BLOCK_MESSAGE =
  'Phone numbers (including numbers written as words), websites, email addresses, messaging handles and full postcodes cannot be posted in TrustFive Social. Keep enquiries and quotes safely inside the app.';

function normalizeSocialText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .trim();
}

function collectContactWarnings(normalized: string): string[] {
  const privacyWarnings: string[] = [];

  if (UK_FULL_POSTCODE_RE.test(normalized)) {
    privacyWarnings.push(
      'Full UK postcodes are not allowed in public Social posts — use your neighbourhood name instead.'
    );
  }
  if (
    UK_PHONE_RE.test(normalized) ||
    GENERIC_PHONE_DIGITS_RE.test(normalized) ||
    SPELLED_DIGITS_RE.test(normalized)
  ) {
    privacyWarnings.push(
      'Telephone numbers are not allowed in TrustFive Social — keep all enquiries inside the app.'
    );
  }
  if (URL_OR_DOMAIN_RE.test(normalized)) {
    privacyWarnings.push(
      'Websites and external web links are not allowed in TrustFive Social — all quotes and profiles stay inside the app.'
    );
  }
  if (EMAIL_RE.test(normalized) || MESSAGING_APP_RE.test(normalized)) {
    privacyWarnings.push(
      'Email addresses and off-platform messaging handles are not allowed in TrustFive Social.'
    );
  }

  return privacyWarnings;
}

/**
 * Mirrors PostgreSQL's showcase_contact_free() guard for fast, accessible
 * feedback across single or multi-field public Social forms. Each field is
 * checked independently so adjacent numbers across separate inputs do not
 * create false positives.
 */
export function publicSocialContactError(...values: string[]): string | null {
  for (const value of values) {
    const normalized = normalizeSocialText(value);
    if (!normalized) continue;
    if (collectContactWarnings(normalized).length > 0) {
      return CONTACT_BLOCK_MESSAGE;
    }
  }
  return null;
}

export const MEDIA_STORAGE_COORDINATION_NOTE =
  'Photo uploads require a coordinated private storage bucket, EXIF/GPS stripping pipeline and moderator-only media RLS migration before activation. No file is uploaded from this check.';

export function validateSocialMediaFile(file: {
  name: string;
  type: string;
  size: number;
}): SocialMediaCheckResult {
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_SOCIAL_IMAGE_TYPES.includes(mime as (typeof ALLOWED_SOCIAL_IMAGE_TYPES)[number])) {
    return {
      ok: false,
      reason: 'Only JPEG, PNG or WebP images are permitted. SVG, HTML and video files are blocked for safety.',
    };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {ok: false, reason: 'The selected image is empty. Choose a valid photo.'};
  }
  if (file.size > MAX_SOCIAL_IMAGE_BYTES) {
    return {
      ok: false,
      reason: 'Images must be 5 MB or smaller before upload so mobile connections stay reliable.',
    };
  }
  const kb = Math.max(1, Math.round(file.size / 1024));
  return {
    ok: true,
    mimeType: mime as (typeof ALLOWED_SOCIAL_IMAGE_TYPES)[number],
    sizeBytes: file.size,
    stripMetadata: true,
    summary: `${file.name} (${kb.toLocaleString('en-GB')} KB, ${mime}) passed format checks. GPS coordinates and EXIF camera metadata will be stripped before storage once media uploads are activated.`,
  };
}

export function assessSocialPostSafety(body: string): SocialPostSafetyAssessment {
  const normalized = normalizeSocialText(body);
  const privacyWarnings = collectContactWarnings(normalized);

  if (privacyWarnings.length > 0) {
    return {
      blockingError: CONTACT_BLOCK_MESSAGE,
      privacyWarnings,
    };
  }

  if (REPEATED_CHAR_RE.test(normalized)) {
    return {
      blockingError: 'Please remove long runs of repeated characters before publishing.',
      privacyWarnings,
    };
  }

  return {blockingError: null, privacyWarnings};
}

export function classifySocialWriteError(
  error: unknown,
  fallbackMessage: string
): string {
  const errObj = error as {code?: unknown; message?: unknown} | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  const msg = typeof errObj?.message === 'string' ? errObj.message : '';
  if (code === '23514' || /contact_free/i.test(msg)) {
    return 'Phone numbers, websites, email addresses and full postcodes are blocked in TrustFive Social. Remove them and keep enquiries inside the app.';
  }
  if (code === 'P0001' || /posting limit reached/i.test(msg)) {
    return 'You have reached the hourly posting limit designed to prevent spam. Your draft is preserved — please try again later.';
  }
  return fallbackMessage;
}
