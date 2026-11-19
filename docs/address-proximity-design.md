# Address-first search and proximity matching (staging)

## What was built
- `/services` replaces the main area dropdown with a postcode/street-address search.
- `POST /api/address/search` keeps raw address input out of query-string logs; server-only `GEOAPIFY_API_KEY` enables global street/house autocomplete from Geoapify. Without a key, a **full UK postcode** is validated against free postcodes.io.
- Postcodes.io coordinates are a **postcode centroid**, not a verified residential or business address; the UI says so.
- Address lookup uses a third-party service; never present it as private/offline location validation. Raw search is not persisted by TrustFive.
- `professional_service_locations` holds private independently reviewed professional service points and coverage radii. There are no anon/authenticated table grants; business coordinates and verification notes are **not public directory fields**.
- `verify_professional_service_location` is restricted to platform admins and accepts only actively approved professionals. Admin UI selects provider location/radius and requires documented independent verification before saving.
- `find_trustfive_professionals_nearby` uses Haversine straight-line distance and professional coverage radii; only approved active professionals whose verified radius covers the customer are returned.
- Recommended ordering weighs capped distance **55%**, independent quality **35%**, genuine completed-job rating **10%**. Businesses without reviews get a neutral ranking contribution (not a public star score). Users can also select closest first, quality score, most completed-job reviews, or name.
- Does not publish the customer's searched address. No exact address is added to URLs, and results show only rounded distance.

## How to activate actual street/house autocomplete
1. Create a Geoapify account at https://myprojects.geoapify.com and obtain an API key under the free usage plan (confirm current free-tier terms/limits before activation).
2. In Vercel's TrustFive project settings, add `GEOAPIFY_API_KEY` as **server-side** Preview environment variable (not `NEXT_PUBLIC_GEOAPIFY_API_KEY`). Do not put the value in GitHub commits or chat.
3. Redeploy the feature preview and verify `POST /api/address/search` with a genuine house/street example. Confirm the result is an address with house number, not just a street-centre suggestion.
4. For worldwide rollout, configure supported countries, rate limiting, GDPR disclosures, data retention, provider billing controls and business address evidence.
5. To make exact property lookups authoritative in the UK, consider a Royal Mail PAF-based provider (e.g. Ideal Postcodes) with its own commercial terms. OpenStreetMap geocoders may not have complete premises coverage.
6. Without this key, a full UK postcode can be used for approximate-centre matching immediately; arbitrary street text cannot resolve an exact premise.

## Approval-capacity, privacy and user journey caveats
- The five-slot rule remains **per trade and defined area**, independent of distance order or paid memberships. A professional can be displayed in a customer's radius search only if currently approved and active in a defined trade/area slot.
- Current staging has **zero approved active professional listings** and thus no ranked nearby results to show. Do not seed fake reviews or approved providers.
- Existing job posting still uses a defined `service_areas` ID for lead permissions and allocation matching. The customer **job-site exact address selection, private storage, and geographically constrained lead delivery still need to be implemented** before claiming full address-first booking across the site.
- Distances are straight line, not route times or confirmed travel time.
- Geoapify or postcodes.io may have rate limits and outages. The endpoint has no persistent rate limiter yet; add abuse protection before open public launch.
- Do not place customers' exact home addresses into public jobs, posts, profiles, business pages, logs, or analytics.

## Verification
- Next.js build, TypeScript and Playwright postcode lookup UI tests are part of GitHub Actions CI.
- PostgreSQL fixture `tests/db/proximity.sql` checks admin-only update, nearby match, radius exclusion, and public-coordinate privacy.
- Staging Supabase has migrations `0016`, `0017`, `0018` applied.
- Verify GitHub CI **on the latest commit** before reporting end-to-end success.
