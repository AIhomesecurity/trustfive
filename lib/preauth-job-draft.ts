export const PREAUTH_JOB_DRAFT_KEY = 'trustfive:customer-job-draft:v1';

export type PreAuthJobDraft = {
  tradeSlug: string;
  title: string;
  description: string;
  areaLabel: string;
  expiresAt: number;
};

/** Keep the pre-login draft limited to the job brief and rough area; never store contact or street-address data here. */
export function parsePreAuthJobDraft(raw: string | null): PreAuthJobDraft | null {
  if (!raw || raw.length > 12_000) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const draft = value as Record<string, unknown>;
    if (typeof draft.tradeSlug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(draft.tradeSlug)) return null;
    if (typeof draft.title !== 'string' || draft.title.trim().length < 5 || draft.title.length > 120) return null;
    if (typeof draft.description !== 'string' || draft.description.trim().length < 15 || draft.description.length > 3000) return null;
    if (typeof draft.areaLabel !== 'string' || draft.areaLabel.trim().length < 2 || draft.areaLabel.length > 80) return null;
    if (typeof draft.expiresAt !== 'number' || !Number.isFinite(draft.expiresAt) || draft.expiresAt <= Date.now()) return null;

    return {
      tradeSlug: draft.tradeSlug,
      title: draft.title.trim(),
      description: draft.description.trim(),
      areaLabel: draft.areaLabel.trim(),
      expiresAt: draft.expiresAt,
    };
  } catch {
    return null;
  }
}
