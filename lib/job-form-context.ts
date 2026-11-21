// The directory, authentication callback and job form exchange trade/area as
// URL hints. Keep the parsing and the "when may an area be replaced?" rule in
// one place so a customer's selection cannot be silently dropped on the way
// through sign-in.

export function resolveJobFormContext(
  params: URLSearchParams,
  trades: ReadonlyArray<{id: string; slug: string}>,
  areas: ReadonlyArray<{id: string}>
): {trade: string; area: string} {
  const requestedTrade = params.get('trade') || '';
  const requestedArea = params.get('area') || '';
  const trade = trades.find(item => item.slug === requestedTrade);
  const area = areas.find(item => item.id === requestedArea);
  return {trade: trade?.id || '', area: area?.id || ''};
}

// An area carried through authentication stays on the form until the customer
// chooses a job-site address. After that, only a territory verified for the
// current address may set the area.
export function areaForJobForm(current: string, siteSelected: boolean, verifiedArea: string): string {
  return siteSelected ? verifiedArea : current;
}

export function jobPostingHref(tradeSlug: string, areaId: string): string {
  const params = new URLSearchParams();
  if (tradeSlug) params.set('trade', tradeSlug);
  if (areaId) params.set('area', areaId);
  return '/jobs' + (params.size ? '?' + params.toString() : '');
}
