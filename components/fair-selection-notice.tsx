import Link from 'next/link';

/**
 * Adapted from the saved TrustFive Experience Lab fairness notice.
 * No Lovable runtime dependencies; safe for the canonical Next.js app.
 */
export default function FairSelectionNotice() {
  return (
    <aside aria-label="How TrustFive selects professionals" className="notice">
      <strong>Selection and ranking are independent of payment.</strong>{' '}
      Professionals cannot pay to enter the five approved places for a trade and territory,
      or to move ahead of a better-qualified applicant. Only independently approved,
      currently eligible professionals are listed.{' '}
      <Link href="/how-it-works" style={{color:'var(--green)',fontWeight:750,textDecoration:'underline'}}>
        Learn how TrustFive works
      </Link>
    </aside>
  );
}
