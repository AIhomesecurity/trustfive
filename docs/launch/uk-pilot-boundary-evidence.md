# TrustFive pilot — independently verified geographical boundaries

**State: BLOCKED pending human review.** As at 2026-11-21 staging has four configured service-area *labels*: Central London, North London, Central Birmingham, Central Manchester. It has zero independently approved polygons, zero active vetted professional allocations and zero approved professional service points. A city or neighbourhood label does not define a legally/operationally reliable polygon.

## Authoritative input candidates
- Office for National Statistics Open Geography / National Data Library, Local Authority Districts (May 2026) Boundaries UK BFE: https://www.data.gov.uk/dataset/1676926f-6c2f-431b-83c0-c08c8e2ae44f/local-authority-districts-may-2026-boundaries-uk-bfe
- ONS Local Authority Districts May 2026 Boundaries UK BFC: https://open-data.org.uk/dataset/ons_geography/3030fda24bc34e3080d326db2942feaf_0
- **Official boundaries represent council districts, not 'Central London' or 'North London' custom business territories.** A responsible TrustFive operator must decide exactly which official districts or independently surveyed sub-district areas each pilot label represents, document the choice, review non-overlap and licensing, and supply original source/version/geometry. Never infer this decision from a postcode centroid.

## Mandatory review package for EACH of the four configured areas
1. Named operator/independent reviewer and review date; primary data publisher, dataset/version and usage licence; original source file URL, stable district codes if applicable.
2. Explicit inclusion/exclusion of relevant boroughs or sub-territories, description of business logic and how five slots map to the area. Determine whether Central London and North London overlap at any point; resolve before approval.
3. Converted WGS84 (longitude, latitude) surveyed polygon with geometry processing/validation by a qualified source. **The app's present PostgreSQL polygon contract supports 3–30 vertices and conservative bounding-box collision rejection**. Detailed council boundary polygons can exceed 30 points; generalisation must be documented, reviewed for coverage error and approved rather than silently truncating coordinates.
4. Exact original source checksum/version, independent evidence note, admin identity, and a recorded human review in the restricted territory-admin interface. Approval must be initiated by a genuine authorised reviewer.
5. Staging negative tests: just outside boundary, just inside, gap or overlap, missing/invalid country, no-coverage customers, and quote/lead denial outside verified radius.
6. Only after authorised review, run `verify_service_territory` via the admin UI, confirm unique country/area coverage, regression tests, and audit. Do not bulk load without reviewing the four actual area definitions.

## Stop conditions
- No verified source for 'Central' or 'North' business regions
- Polygon conversion simplifies away important boundary detail; overlaps another vetted territory
- Different source coordinate reference system or unverified licence
- No independent reviewer/evidence, or staging authentication absent
- Boundary has been fabricated for demo purposes

**Do not seed any 'approved' polygon to pass launch checks.** The country release gate in migration 0033 remains blocked until reviewed polygons, genuinely vetted in-country professionals with verified service points and all separate legal/privacy/payment/security/operations/acceptance signoffs exist. Even if all gates were recorded, production release still requires an explicit owner deployment decision.
