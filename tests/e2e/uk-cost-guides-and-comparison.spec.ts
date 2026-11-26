import {expect, test} from '@playwright/test';
import {
  buildJobsPrefillHref,
  calculateEstimate,
  findTradeCostGuide,
  parseJobsPrefillParams,
  UK_COST_GUIDES,
} from '../../lib/uk-cost-guides';
import {
  calculateAnnualLeadFeeSavings,
  TRUSTFIVE_VETTING_STAGES,
  UK_PLATFORM_COMPARISON,
} from '../../lib/marketplace-comparison';

test.describe('UK cost guides, 7-platform comparison and vetting unit contracts', () => {
  test('covers all 20 UK trades, scales estimates honestly and builds safe /jobs prefill links', () => {
    expect(UK_COST_GUIDES).toHaveLength(20);
    const cctv = findTradeCostGuide('cctv-installation');
    expect(cctv.tradeSlug).toBe('cctv-installation');
    const standard = calculateEstimate({job: cctv.jobs[0], complexity: 'standard', urgency: 'flexible'});
    const urgentComplex = calculateEstimate({job: cctv.jobs[0], complexity: 'complex', urgency: 'urgent'});
    expect(urgentComplex.lowGbp).toBeGreaterThan(standard.lowGbp);
    expect(urgentComplex.highGbp).toBeGreaterThan(standard.highGbp);
    expect(standard.note).toMatch(/not a binding quote/i);

    const href = buildJobsPrefillHref({
      tradeSlug: 'cctv-installation',
      jobTitle: cctv.jobs[0].title,
      midGbp: standard.midGbp,
      urgency: 'this_week',
      propertyType: 'house',
      siteNotes: 'Brick semi with loft access',
    });
    expect(href.startsWith('/jobs?')).toBe(true);
    const parsed = parseJobsPrefillParams(href.slice('/jobs'.length));
    expect(parsed.trade).toBe('cctv-installation');
    expect(parsed.title).toBe(cctv.jobs[0].title);
    expect(parsed.budget).toBe(String(standard.midGbp));
    expect(parsed.brief).toContain('Brick semi with loft access');
    expect(parseJobsPrefillParams('?budget=not-a-number').budget).toBe('');
  });

  test('includes all benchmarked UK platforms and bounds illustrative lead-fee calculations', () => {
    const names = UK_PLATFORM_COMPARISON.map((row) => row.platform);
    for (const expected of [
      'TrustFive',
      'Checkatrade',
      'MyBuilder',
      'Bark',
      'MyJobQuote',
      'TrustATrader',
      'Which? Trusted Traders',
      'FreeIndex / Nextdoor / Google Business Profile',
    ]) {
      expect(names).toContain(expected);
    }
    expect(TRUSTFIVE_VETTING_STAGES).toHaveLength(6);

    const calc = calculateAnnualLeadFeeSavings({monthlyQuotes: 20, avgLeadFeeGbp: 25});
    expect(calc.monthlyLeadSpendGbp).toBe(500);
    expect(calc.annualLeadSpendGbp).toBe(6000);
    expect(calc.trustFiveLeadFeesGbp).toBe(0);
    expect(calc.annualLeadFeeSavingsGbp).toBe(6000);
  });
});

test.describe('Homepage, /cost-guides and /how-it-works reverse-engineered features', () => {
  test('homepage preserves TrustFive palette and renders cost estimator, 7-platform comparison and vetting stages without 360px overflow', async ({
    page,
  }) => {
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto('/');

    // Confirm existing TrustFive colours remain untouched.
    const palette = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        green: root.getPropertyValue('--green').trim(),
        dark: root.getPropertyValue('--dark').trim(),
        bg: root.getPropertyValue('--bg').trim(),
      };
    });
    expect(palette.green).toBe('#087c46');
    expect(palette.dark).toBe('#123c2b');
    expect(palette.bg).toBe('#f5faf7');

    // Interactive estimator updates live when trade/urgency changes.
    const est = page.getByTestId('trade-cost-estimator');
    await expect(est).toBeVisible();
    const initialPrice = await est.getByTestId('estimator-price-range').textContent();
    await est.getByLabel('Trade category').selectOption('heating');
    await est.getByLabel('Job size & access').selectOption('complex');
    const updatedPrice = await est.getByTestId('estimator-price-range').textContent();
    expect(updatedPrice).not.toBe(initialPrice);

    // Comparison table filters cleanly on desktop.
    const comp = page.getByTestId('platform-comparison');
    await expect(comp).toContainText('Checkatrade');
    await expect(comp).toContainText('MyBuilder');
    await expect(comp).toContainText('Bark');
    await expect(comp).toContainText('MyJobQuote');
    await expect(comp).toContainText('TrustATrader');
    await expect(comp).toContainText('Which? Trusted Traders');
    await comp.getByRole('button', {name: 'vs Pay-per-lead sites'}).click();
    await expect(comp.locator('tbody tr')).toHaveCount(4);

    // 6-stage vetting cards visible.
    await expect(page.getByTestId('vetting-charter').locator('.tf-vetting-card')).toHaveCount(6);

    // Check 360px mobile has zero horizontal overflow.
    await page.setViewportSize({width: 360, height: 780});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('/cost-guides renders all 20 UK trade guides, updates estimator live and hands off prefill params to /jobs', async ({
    page,
  }) => {
    await page.setViewportSize({width: 360, height: 780});
    await page.goto('/cost-guides?trade=electrical');
    await expect(page.getByRole('heading', {level: 1})).toContainText(/fair UK job costs/i);
    await expect(page.locator('.tf-guide-card')).toHaveCount(20);

    const est = page.getByTestId('trade-cost-estimator');
    await expect(est.getByLabel('Trade category')).toHaveValue('electrical');
    await est.getByLabel('Optional notes for your job brief').fill('1930s semi with hallway board');
    const postHref = await est.getByRole('link', {name: 'Post this job for free quotes'}).getAttribute('href');
    expect(postHref).toContain('/jobs?trade=electrical');
    expect(postHref).toContain('1930s+semi+with+hallway+board');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('/how-it-works renders vetting charter, code of conduct and live tradesperson lead-fee calculator', async ({
    page,
  }) => {
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto('/how-it-works');
    await expect(page.getByTestId('vetting-charter')).toContainText('The TrustFive transparent standards charter');

    const calc = page.getByTestId('lead-fee-calculator');
    await expect(calc).toBeVisible();
    await calc.getByLabel(/Quotes sent per month/i).fill('20');
    await calc.getByLabel(/Typical lead \/ shortlist fee/i).fill('30');
    await expect(calc.getByTestId('annual-lead-spend')).toContainText('£7,200');
  });
});
