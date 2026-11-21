# TrustFive UK-first release — legal, payments, privacy and operations evidence

**Unapproved / NOT LEGAL ADVICE / no production payments authorised.** This is an operational evidence matrix to support independent professional review, not an assertion of compliance. Date: 2026-11-21.

## Country scope
Approval is country-specific. A UK review does not approve worldwide launch; each jurisdiction needs trade licensing, consumer terms, data protection, payments/tax and dispute review. The country_release_signoffs schema and trustfive_admin_country_release_gate('GB') separate those decisions.

## Human release gates — all must be independently reviewed and evidenced

| Gate | Reviewer / evidence required | Current release state |
| --- | --- | --- |
| legal_terms | Qualified UK legal adviser reviews customer/professional terms, cancellation rights, complaint handling, reviews/moderation, liability, insurance and trade regulations; signed date/version/reference | BLOCKED — no completed legal review |
| privacy | Data-protection lead/legal adviser approves lawful basis, privacy notice, retention/deletion, location precision, exact-address disclosure and revocation, supplier agreements, cross-border transfers and incident handling | BLOCKED — no signed privacy assessment |
| payments | Financial/legal owners determine whether TrustFive supplies payment services; confirm Stripe Connect model, KYC, refunds, disputes, tax/VAT, reconciliation and test-mode acceptance. Live credentials require separate explicit approval | BLOCKED — Stripe test membership only; no live payments or payouts |
| security | Independent security reviewer approves RLS, penetration/role escalation review, logs, secrets, backups, rollback, CI matching release SHA | BLOCKED — CI alone is not production security review |
| operational_support | Named operator approves incident response, support coverage, vetted-professional dispute/appeal handling, moderation, fraud response and recovery | BLOCKED — operator ownership unverified |
| authenticated_acceptance | Authorised test owner signs in on staging using an existing customer, genuinely vetted eligible professional and unrelated user; demonstrates job→quote→booking→address consent→completion→review and denial paths | BLOCKED — no such staging participants or reviewed territories |

Only an authorised admin may record or revoke a country-specific decision through record_country_release_signoff(country,gate,approved,evidenceReference,reviewerName). The entry stores reviewer, reference and timestamp, but **does not establish the authenticity of the underlying document**. Recording it never deploys the site or enables billing. The country release report also requires reviewed territory and vetted professional-service coverage. Zero records fail closed.

## Official review sources
- UK FCA guidance on whether online marketplaces may provide payment services: https://www.fca.org.uk/firms/consider-if-you-provide-payment-services
- ICO data protection by design and default: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-by-design-and-by-default
- ICO lawful basis guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/
- Stripe Connect and PSD2 questions: https://stripe.com/gb/guides/frequently-asked-questions-about-stripe-connect-and-psd2
- TrustFive existing test subscription and unfinished commercial payments: docs/stripe-test-memberships.md

## Safe approval process
1. Reviewer independently checks the latest source and legal/payment/operational evidence. Keep personal/private or confidential documents out of GitHub issues.
2. An actual authorised administrator records a narrowly scoped, revocable decision with a safe evidence reference; negative outcomes remain unapproved.
3. Verify country release report and redacted staging acceptance evidence against one exact Git commit and READY deployment.
4. Obtain separate explicit owner approval before production merge, marketplace launch, real professional approval, live Stripe use or payments handling.

## Revocation and rollback
Missing, stale, rejected or revoked legal/privacy/payment/acceptance evidence means BLOCKED. New documents or policy changes require reassessment. A green CI build or paid subscription in Stripe sandbox is not evidence that refunds, payouts or marketplace commissions are operational.
