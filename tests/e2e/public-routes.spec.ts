import {test,expect} from '@playwright/test';

test('TrustFive landing page offers original service search and balanced trade navigation',async({page})=>{
 await page.goto('/');
 await expect(page).toHaveTitle(/TrustFive/i);
 await expect(page.getByRole('heading',{level:1})).toContainText(/people you can trust/i);
 await expect(page.getByRole('searchbox',{name:'What do you need help with?'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Find a professional'})).toBeVisible();
 const categories=page.locator('.service-grid .service-tile');
 await expect(categories).toHaveCount(20);
 await expect(page.locator('.service-grid a[href="/services?trade=plumbing"]')).toBeVisible();
 await page.locator('.service-grid a[href="/services?trade=plumbing"]').click();
 await expect(page).toHaveURL(/\/services\?trade=plumbing$/);
 await expect(page.getByRole('heading',{name:'Find a TrustFive professional'})).toBeVisible();
});

test('CCTV search routes to the camera-installation trade and keeps the category visible',async({page})=>{
 await page.goto('/');
 const search=page.getByRole('searchbox',{name:'What do you need help with?'});
 await search.fill('CCTV');
 await page.getByRole('button',{name:'Find a professional'}).click();
 await expect(page).toHaveURL(/\/services\?q=CCTV$/);
 await expect(page.getByRole('heading',{name:'Find a TrustFive professional'})).toBeVisible();
 await expect(page.getByLabel('Trade or service')).toBeVisible();
 await page.goto('/');
 await expect(page.locator('.service-grid a[href="/services?trade=cctv-installation"]')).toBeVisible();
});

test('Homepage trade grid uses four columns at desktop and two on phones',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 const grid=page.locator('.service-grid');
 await expect(grid).toHaveCSS('grid-template-columns',/[0-9.]+px [0-9.]+px [0-9.]+px [0-9.]+px/);
 await page.setViewportSize({width:390,height:844});
 await expect(grid).toHaveCSS('grid-template-columns',/[0-9.]+px [0-9.]+px/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Professional directory offers filtering and an honest empty result state',async({page})=>{
 await page.goto('/services?trade=plumbing');
 await expect(page.getByRole('heading',{name:'Find a TrustFive professional'})).toBeVisible();
 await expect(page.getByLabel('Trade or service')).toBeVisible();
 await expect(page.getByLabel('Your postcode or street address')).toBeVisible();
 await expect(page.getByLabel('Sort results')).toBeVisible();
 await expect(page.getByRole('link',{name:'Describe your job'})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(page).toHaveURL(/\/services$/);
});

test('Address-first directory validates a UK postcode and offers location selection',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({suggestions:[{
   label:'SW1A 1AA, Westminster, United Kingdom',latitude:51.501,longitude:-0.142,
   postcode:'SW1A 1AA',precision:'postcode',country:'GB'
  }],message:'Postcode-centre location (not a specific house)'})});
 });
 await page.goto('/services?trade=plumbing');
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('SW1A 1AA');
 await expect(page.getByRole('option',{name:/SW1A 1AA/})).toBeVisible();
 await page.getByRole('option',{name:/SW1A 1AA/}).click();
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('SW1A 1AA');
 await expect(page.getByText(/postcode centre, not your exact property/i)).toBeVisible();
 await expect(page.getByLabel('Sort results')).toHaveValue('recommended');
});

test('Address search endpoint rejects invalid input without leaking an API key',async({request})=>{
 const response=await request.post('/api/address/search',{data:{query:'X'}});
 expect(response.status()).toBe(400);
 const body=await response.json() as {suggestions:unknown[];message:string};
 expect(body.suggestions).toHaveLength(0);
 expect(JSON.stringify(body)).not.toContain('GEOAPIFY_API_KEY');
});

test('How TrustFive works explains the five-place rule without promising unavailable guarantees',async({page})=>{
 await page.goto('/how-it-works');
 await expect(page.getByRole('heading',{name:'Less searching. More confidence.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'What the five-place rule actually means'})).toBeVisible();
 await page.getByText('Are tradespeople employees of TrustFive?').click();
 await expect(page.getByText('The professionals are independent businesses.')).toBeVisible();
 await expect(page.getByRole('link',{name:'Browse trusted trades'})).toBeVisible();
});

test('Job selection is preserved when an anonymous customer signs in',async({page})=>{
 await page.goto('/jobs?trade=plumbing&area=test-area');
 await expect(page).toHaveURL(/\/account\?next=/);
 const redirected=new URL(page.url());
 expect(redirected.searchParams.get('next')).toBe('/jobs?trade=plumbing&area=test-area');
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

test('Registration and sign-in tabs switch without a backend account',async({page})=>{
 await page.goto('/account');
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 await expect(page.getByLabel('I am joining as')).toBeVisible();
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sign in to TrustFive'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Forgot your password?'})).toBeVisible();
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

test('Anonymous members are redirected from personal accounts',async({page})=>{
 await page.goto('/dashboard');
 await expect(page).toHaveURL(/\/account\?next=/);
 await page.goto('/community/groups');
 await expect(page).toHaveURL(/\/account\?next=/);
 await page.goto('/schedule');
 await expect(page).toHaveURL(/\/account\?next=/);
});

test('Health endpoint reports configured app without exposing credentials',async({request})=>{
 const response=await request.get('/api/health');
 expect(response.ok()).toBeTruthy();
 const payload=await response.json() as {service:string;status:string;timestamp:string};
 expect(payload.service).toBe('trustfive-web');
 expect(payload.status).toBe('ok');
 expect(payload.timestamp).toBeTruthy();
 expect(JSON.stringify(payload)).not.toContain('sb_publishable_');
});
