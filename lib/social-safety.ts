export const ALLOWED_SOCIAL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_SOCIAL_IMAGE_BYTES = 5 * 1024 * 1024;

export type SocialMediaCheckResult =
  | {ok: true; mimeType: (typeof ALLOWED_SOCIAL_IMAGE_TYPES)[number]; sizeBytes: number; stripMetadata: true; summary: string}
  | {ok: false; reason: string};

export type SocialPostSafetyAssessment = {
  blockingError: string | null;
  privacyWarnings: string[];
};

const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const REPEATED_CHAR_RE = /(\S)\1{11,}/;
const UK_FULL_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const UK_PHONE_RE = /(?:\+44\s?7\d{3}|\b07\d{3}|\b0[12]\d{2,3})[\s-]?\d{3}[\s-]?\d{3,4}\b/;

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
  const text = body.trim();
  const privacyWarnings: string[] = [];

  if (UK_FULL_POSTCODE_RE.test(text)) {
    privacyWarnings.push(
      'This looks like a full UK postcode — use your neighbourhood name instead of a home or job-site address.'
    );
  }
  if (UK_PHONE_RE.test(text)) {
    privacyWarnings.push(
      'This looks like a telephone number — avoid publishing personal or customer contact numbers.'
    );
  }

  const urls = text.match(URL_RE) ?? [];
  if (urls.length > 2) {
    return {
      blockingError: 'Please include no more than two web links in a single post to prevent spam.',
      privacyWarnings,
    };
  }
  if (REPEATED_CHAR_RE.test(text)) {
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
  if (code === 'P0001' || /posting limit reached/i.test(msg)) {
    return 'You have reached the hourly posting limit designed to prevent spam. Your draft is preserved — please try again later.';
  }
  return fallbackMessage;
}
