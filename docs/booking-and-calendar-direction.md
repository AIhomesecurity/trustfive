# TrustFive booking and calendar direction

**Decision date:** 28 November 2026  
**Scope:** UK-first marketplace, designed for solo professionals and companies with staff.

## Product decision

Keep TrustFive bookings, availability, job assignment and permissions in the existing TrustFive application and Supabase database. Add an optional Google Calendar connection for each professional. Do not make Cal.diy or another separate scheduler the source of truth.

The current application already negotiates a proposed appointment for an accepted job, requires the other participant to confirm it, checks professional overlap, preserves IANA time zones, and exports confirmed or proposed appointments as `.ics`. It does not yet publish bookable availability, manage staff calendars, or synchronize Google events.

## Why not self-host Cal.diy on the free plan?

Cal.diy is an open-source self-hosted application, but its maintainers describe it as intended for personal/non-production use and warn that operating it requires substantial infrastructure and security experience. Cloudflare Workers Free is not a general Node server for running that application. Cloudflare Containers currently require Workers Paid, with a $5/month minimum before usage. A second Supabase account would provide another database/auth service; it would not run the Cal.diy web application or its background jobs.

References: [Cal.diy project](https://github.com/calcom/cal.diy), [Cloudflare Containers pricing](https://developers.cloudflare.com/containers/pricing/), [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Booking experience

Use patterns from Setmore and job-management products while keeping TrustFive's job and quote rules:

- Open the professional calendar on **Day** view; let them switch to **Agenda**, **3 days**, and **Week**. Add Month and Team views after staff calendars exist.
- Support date navigation, clear empty days, status labels, time zone display, job details, customer notes and quick actions.
- Keep quote-based jobs for variable work. Offer instant self-booking only for a professional's explicitly configured consultation or fixed service, with duration, lead time, buffers and cancellation rules.
- Never show an open slot until the database has confirmed that it is available. A slot claim must be atomic so two customers cannot book it simultaneously.
- Keep proposals, confirmations, cancellation, rescheduling and job completion in TrustFive. A calendar event mirrors a booking; it does not itself confirm the booking.

Setmore documents Agenda/Day/Week/Month/Team views, staff hours, breaks, time off, and external calendar sync. Its current plan pages place two-way sync and SMS on paid tiers. TrustFive should adopt those useful workflow patterns, not copy Setmore's interface. References: [Setmore calendar views](https://support.setmore.com/en/articles/491547-calendar-views), [Setmore calendar sync](https://support.setmore.com/en/articles/491560-sync-your-calendar), [Setmore pricing](https://www.setmore.com/pricing).

## Solo and company accounts

Treat this as an account capability change, not a different booking system.

| Capability | Solo professional | Team / company |
|---|---|---|
| Owner schedule | One personal calendar | Company-wide schedule and personal calendars |
| Availability | Weekly hours, breaks, holidays and time off | Per-employee hours, breaks, leave and capacity |
| Assignment | Owner handles each job | Owner or scheduler assigns a job to an employee |
| Access | Owner | Owner, scheduler and assigned worker roles |
| Customer access | Customer sees only their own jobs and agreed times | Customer still sees the assigned service contact and their own job |
| Reporting | Personal bookings and completed jobs | Team workload, missed jobs, reschedules and completion |

A company schedule requires an organisation record, memberships with explicit roles, assigned worker IDs on jobs/appointments, and row-level policies that scope every read and write to the company. A company owner must not automatically make every worker's private calendar visible to customers.

## Google Calendar connection

Google sign-in and calendar access are separate grants. Joining with Google must not silently authorize TrustFive to read or change a user's calendar.

1. Keep TrustFive as the booking source of truth and preserve the current `.ics` export as the zero-integration fallback.
2. Start calendar connection with the narrowest scope that supports the selected feature. Read-only free/busy can block conflicts without revealing private event names.
3. Request event-write permission separately when the user opts into adding TrustFive bookings to Google Calendar.
4. Store refresh tokens encrypted, support disconnect/revocation, use idempotency keys, and never log tokens or event descriptions.
5. Use Google incremental sync tokens and retain deletion tombstones. If Google returns an expired token, rebuild that calendar's local sync state before resuming. Do not implement polling without deduplication and retry limits.
6. Explain conflicts before confirming an appointment. A Google busy event blocks availability, but does not cancel or silently change a TrustFive booking.

Google advises using the narrowest OAuth scope and notes that public apps requesting sensitive calendar data may need OAuth verification. Its incremental-sync guide requires persisted sync tokens and a full resync after an expired token. References: [Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth), [OAuth sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync).

## Free-first service levels

- Keep the personal agenda, booking proposals, customer confirmations, `.ics` export, and Google connection available without requiring an external scheduler.
- Add email reminders after delivery, consent, bounce handling and retry behavior are proven.
- Make SMS an explicit, priced/usage-limited feature because each text has a delivery cost. Require recipient consent and provide delivery status.
- Gate company seats, employee assignment, multiple locations, advanced reporting, automation and AI assistance through explicit account entitlements. Never let paid status affect professional approval, the five-active-professional limit, search ranking or the fair waiting list.
- Keep plan checks server-side and test downgrade behavior, staff access removal and data retention before charging customers.

## Delivery order

1. Day-first Agenda/Day/3-day/Week views on existing appointments. **In progress in this branch.**
2. Recurring weekly hours, exceptions/time off, buffers and service durations.
3. Atomic customer self-booking for configured service types; preserve the quote flow for projects.
4. Company membership roles and employee assignment with tenant-scoped RLS.
5. Google free/busy, then optional event write, revocation and resync handling.
6. Reliable email and opt-in SMS reminders, then plan entitlements and usage controls.
7. Month/Team views, calendar analytics, and a draft-only professional AI assistant.

Each step needs a migration/security review where relevant, focused tests, mobile checks and an isolated preview rehearsal before it is considered complete.