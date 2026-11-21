import {expect,test} from '@playwright/test';

/** Verify billing and health endpoints fail closed, enforce no-store caching,
 * never leak credentials, and preserve test-mode-only boundaries. */

test('Billing checkout endpoint rejects GET and fails closed when Stripe test mode is unconfigured',async({request})=>{
 const getRes=await request.get('/api/billing/checkout');
 expect(getRes.status()).toBe(405);

 const postRes=await request.post('/api/billing/checkout',{
  headers:{origin:'http://127.0.0.1:3112'},
 });
 expect(postRes.status()).toBe(503);
 expect(postRes.headers()['cache-control']).toContain('no-store');
 const body=await postRes.text();
 expect(body).toContain('No charge was attempted');
 expect(body).not.toMatch(/sk_test_|sk_live_|whsec_|service_role/i);
});

test('Stripe webhook endpoint rejects GET and fails closed with no-store when unconfigured',async({request})=>{
 const getRes=await request.get('/api/billing/webhook');
 expect(getRes.status()).toBe(405);

 const postRes=await request.post('/api/billing/webhook',{
  data:'{"id":"evt_fake","livemode":true}',
  headers:{'content-type':'application/json'},
 });
 expect(postRes.status()).toBe(503);
 expect(postRes.headers()['cache-control']).toContain('no-store');
 const body=await postRes.text();
 expect(body).toContain('Test webhook is not configured');
 expect(body).not.toMatch(/sk_test_|sk_live_|whsec_|service_role/i);
});

test('Readiness health endpoint sets no-store and never discloses secrets or database credentials',async({request})=>{
 const res=await request.get('/api/health/ready');
 expect([200,503]).toContain(res.status());
 expect(res.headers()['cache-control']).toContain('no-store');
 const json=await res.json() as {service?:string;ready?:boolean;backend?:string};
 expect(json.service).toBe('trustfive-web');
 expect(typeof json.ready).toBe('boolean');
 expect(JSON.stringify(json)).not.toMatch(/supabase\.co|sb_publishable|service_role|sk_test_|sk_live_/i);
});

test('Anonymous /billing access redirects through /account with preserved return path and exposes no checkout UI',async({page})=>{
 await page.goto('/billing');
 await expect(page).toHaveURL(/\/account\?next=%2Fbilling$/);
 await expect(page.getByRole('button',{name:/Open Stripe test checkout/i})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:/TrustFive Business Membership/i})).toHaveCount(0);
});
