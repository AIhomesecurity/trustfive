/**
 * Narrow, explicit baseline of lint violations that predate the ESLint repair.
 *
 * Entries are scoped to the exact file(s) and rule(s) concerned. New files and
 * new rules are NOT baselined, so CI continues to catch regressions. When a
 * legacy violation is fixed in normal work, remove its baseline entry.
 */
export const legacyViolations = [];
