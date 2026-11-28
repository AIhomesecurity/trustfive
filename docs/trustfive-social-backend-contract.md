# TrustFive Social real backend implementation (draft)

## Dependency chain

- [PR #58](https://github.com/AIhomesecurity/trustfive/pull/58): real neighbourhood feed, posts, authenticated discussions, Q&A, moderation reports, permalinks
- [PR #59](https://github.com/AIhomesecurity/trustfive/pull/59): real public community group discovery; depends on #58
- [PR #60](https://github.com/AIhomesecurity/trustfive/pull/60): structured, registered-professional collaboration requests and interest; depends on #59 and includes migration `0050_social_trade_collaboration_foundation.sql`

These are separate **DRAFT** PRs. A passing build or database contract does not mean they have been integrated, deployed, or authenticated-staging tested. The original Social PR #39 is superseded by clean PR #58 and must not be merged alongside it.

## Collaboration privacy and authorisation contract

`social_trade_requests` contains only: request UUID, creator UUID, general trade UUID, general service-area UUID, enum assistance type, optional earliest-week date, open/closed status, timestamps. It deliberately contains no customer-job reference, exact address, phone, email, quote, free-text message, contact mechanism, customer review, or monetary bidding field. The presence of a requested general trade or area does not imply a professional has been vetted or approved.

`social_trade_interests` contains only request UUID, responder UUID and timestamp. Primary key prevents duplicate interest from one responder. No private messaging exists. Consent for future information exchange and any existing TrustFive customer job must be handled separately by the customer's authorised marketplace workflow.

**RLS:**

- Anonymous callers have no grants on collaboration tables.
- Reading open requests requires an actual `professional_applications` row in pending / under-review / eligible status. Original creators can read their own closed requests.
- Inserting an open request requires the same registration evidence and an authenticated creator ID equal to `auth.uid()`.
- Creators may update only the lifecycle `status` column; trade, area and authorship are immutable after creation. Server RLS enforces ownership.
- An eligible registered professional may express interest in an open request only if not its creator.
- Each interest is readable only by the responder or request creator, and only the responder can withdraw it.
- Daily write-quota triggers restrict unbounded request/interest insertion even if the client interface is bypassed.
- Nothing in these tables grants approval, creates an active allocation or affects the independent five-per-trade-per-area rule. Social popularity and payment are not used for rank or capacity.

**Known limitations:** A registered professional may still be unverified. Admin moderation, interest approvals, private messaging, account blocking, reporting individual collaboration requests, upload validation, international coverage activation and meaningful performance measurements remain separate future milestones. The UI clearly states these restrictions.

## Required review and release gates

1. Reconcile migration `0050_*` with all previously pending `0036_*` through `0039_*` integration migrations, plus any other agents' additions; retain one deterministic migration order.
2. Confirm PostgreSQL 16 test `tests/db/social-trade-collaboration-contract.sql` passes on exact integration SHA, including default grant revocation, authenticated ACLs, non-professional denial, author-only update, closed-request security and no protected customer columns.
3. Run TypeScript, build, lint (when available) and Playwright on exact integrated SHA.
4. Verify only authorised, consented synthetic staging professional accounts can create, view, express or withdraw requests. Confirm a customer-only test identity cannot see or create requests.
5. Verify no customer job/customer address/contact detail can enter this collaboration model, and none are disclosed in notifications or logs. Do not turn on private messaging before separate security review.
6. Complete human review of verification and country/area release before exposing the feature to customers.

**No production merge or migration has been authorised by this draft.**
