/** Original TrustFive customer search vocabulary. These are navigation hints
 * only: a match never implies approval, availability or a purchased position. */
export type TradeChoice = { id: string; name: string; slug: string };

export type TradeMatchReason = 'exact' | 'alias' | 'partial' | 'typo';
export type TradeMatch = { trade: TradeChoice; score: number; reason: TradeMatchReason };
export type TradeSearchResult = {
  matches: TradeMatch[];
  best?: TradeMatch;
  reason: 'empty' | 'matched' | 'unknown';
};

const weakTerms = new Set(['and', 'the', 'for', 'with', 'from', 'your']);

export const tradeAliases: Readonly<Record<string, string>> = {
  plumber: 'plumbing', plumbers: 'plumbing', leak: 'plumbing', leaks: 'plumbing',
  tap: 'plumbing', taps: 'plumbing', dripping: 'plumbing', pipe: 'plumbing',
  pipework: 'plumbing', 'burst pipe': 'plumbing',
  electrician: 'electrical', electricians: 'electrical', rewiring: 'electrical',
  wiring: 'electrical', sockets: 'electrical', lights: 'electrical', lighting: 'electrical',
  roofer: 'roofing', roofers: 'roofing', guttering: 'roofing', gutter: 'roofing',
  'roof repair': 'roofing', chimneys: 'roofing',
  gardener: 'gardening', gardeners: 'gardening', lawn: 'gardening', mowing: 'gardening',
  'grass cutting': 'gardening', hedge: 'gardening', hedges: 'gardening',
  painter: 'painting', painters: 'painting', decorator: 'painting',
  decorators: 'painting', decorating: 'painting', walls: 'painting',
  boiler: 'heating', boilers: 'heating', heating: 'heating', radiator: 'heating',
  radiators: 'heating', gas: 'heating', 'central heating': 'heating',
  carpenter: 'carpentry', carpenters: 'carpentry', joiner: 'carpentry',
  joinery: 'carpentry', woodwork: 'carpentry',
  cleaner: 'cleaning', cleaners: 'cleaning', cleaning: 'cleaning',
  housekeeping: 'cleaning', 'deep clean': 'cleaning', 'deep cleaning': 'cleaning',
  'end of tenancy': 'cleaning', oven: 'cleaning',
  removals: 'moving', removal: 'moving', movers: 'moving', moving: 'moving',
  locksmith: 'home-security', locksmiths: 'home-security', locks: 'home-security',
  'home security': 'home-security', 'burglar alarm': 'home-security',
  landscaper: 'landscaping', landscapers: 'landscaping', paving: 'landscaping',
  patio: 'landscaping', patios: 'landscaping', 'garden design': 'landscaping',
  cctv: 'cctv-installation', camera: 'cctv-installation', cameras: 'cctv-installation',
  'security camera': 'cctv-installation', 'security cameras': 'cctv-installation',
  'cctv installer': 'cctv-installation', 'cctv installers': 'cctv-installation',
  'cctv installation': 'cctv-installation', 'video surveillance': 'cctv-installation',
  'home surveillance': 'cctv-installation', surveillance: 'cctv-installation',
  'ring doorbell': 'cctv-installation', 'video doorbell': 'cctv-installation',
  'doorbell camera': 'cctv-installation', 'ip camera': 'cctv-installation',
  alarms: 'home-security', 'alarm system': 'home-security',
  'alarm installation': 'home-security', 'burglar alarms': 'home-security',
  'intruder alarm': 'home-security', 'security alarm': 'home-security',
  handyman: 'handyman', 'odd jobs': 'handyman', repairs: 'handyman',
  furniture: 'furniture-assembly', 'flat pack': 'furniture-assembly',
  flooring: 'flooring', floors: 'flooring', laminate: 'flooring',
  drainage: 'drainage', drains: 'drainage', 'blocked drain': 'drainage',
  plastering: 'plastering', plasterer: 'plastering', ceilings: 'plastering',
  bathroom: 'bathrooms', bathrooms: 'bathrooms', tiling: 'bathrooms',
  kitchen: 'kitchens', kitchens: 'kitchens', 'kitchen fitting': 'kitchens',
  windows: 'windows', doors: 'windows', glazing: 'windows'
};

/** Search text is untrusted user input; reduce it to comparable words only. */
export function normaliseTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Damerau-Levenshtein distance, including adjacent-letter transpositions. */
function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const rows = left.length + 1, cols = right.length + 1;
  const distance: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      distance[i][j] = Math.min(
        distance[i - 1][j] + 1,
        distance[i][j - 1] + 1,
        distance[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        distance[i][j] = Math.min(distance[i][j], distance[i - 2][j - 2] + cost);
      }
    }
  }
  return distance[left.length][right.length];
}

function typoAllowance(term: string): number {
  if (term.length >= 8) return 2;
  if (term.length >= 5) return 1;
  return 0;
}

function scoreTerm(term: string, trade: TradeChoice): TradeMatch | undefined {
  const slug = normaliseTerm(trade.slug);
  const name = normaliseTerm(trade.name);
  if (term === slug || term === name) return { trade, score: 100, reason: 'exact' };

  let partialAlias: TradeMatch | undefined;
  for (const [alias, target] of Object.entries(tradeAliases)) {
    if (target !== trade.slug) continue;
    const key = normaliseTerm(alias);
    if (term === key) return { trade, score: 95, reason: 'alias' };
    if (term.length >= 3 && !weakTerms.has(term) && (key.includes(term) || term.includes(key))) {
      partialAlias ??= { trade, score: 82, reason: 'alias' };
    }
  }
  if (partialAlias) return partialAlias;
  if (term.length >= 3 && !weakTerms.has(term) && (name.includes(term) || slug.includes(term))) {
    return { trade, score: 70, reason: 'partial' };
  }

  // Only tolerate small typos in meaningful words. A short fragment such as
  // "img" must never be coerced into a trade just to avoid an empty state.
  const allowance = typoAllowance(term);
  if (allowance === 0) return undefined;
  const candidates = new Set<string>([name, slug]);
  for (const [alias, target] of Object.entries(tradeAliases)) {
    if (target === trade.slug) candidates.add(normaliseTerm(alias));
  }
  let bestScore = 0;
  for (const candidate of candidates) {
    for (const word of candidate.split(' ')) {
      if (word.length < 4 || Math.abs(word.length - term.length) > allowance) continue;
      const distance = editDistance(term, word);
      if (distance === 0 || distance > allowance) continue;
      bestScore = Math.max(bestScore, 60 - distance * 8);
    }
  }
  return bestScore ? { trade, score: bestScore, reason: 'typo' } : undefined;
}

/** Resolve free-text service terms to real database categories only. */
export function resolveTradeQuery(query: string, trades: readonly TradeChoice[]): TradeSearchResult {
  const term = normaliseTerm(query);
  if (!term) return { matches: [], reason: 'empty' };
  const matches = trades
    .map(trade => scoreTerm(term, trade))
    .filter((match): match is TradeMatch => Boolean(match))
    .sort((a, b) => b.score - a.score || a.trade.name.localeCompare(b.trade.name))
    .slice(0, 6);
  // Require a clear signal before selecting a category; weaker results are
  // offered as suggestions the customer can confirm.
  const best = matches.find(match => match.score >= 50);
  return { matches, best, reason: best ? 'matched' : 'unknown' };
}
