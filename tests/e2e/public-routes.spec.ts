import {test,expect} from '@playwright/test';
import {jobAddressLabel} from '../../lib/job-address';
import {quoteMessagesHref,bookingScheduleHref,bookingHistoryHref,authorisedQuoteSelection,authorisedBookingSelection} from '../../lib/workflow-links';
import {canConfirmJobQuote} from '../../lib/quote-confirmation';
import {loadBookingSiteBatch} from '../../lib/booking-site-batch';

test('Postcode-only jobs require a private property line without inventing exact coordinates',()=>{
 const postcode={label:'SW1A 1AA, Westminster, United Kingdom',latitude:51.501,longitude:-0.142,postcode:'SW1A 1AA',precision:'postcode' as const,country:'GB'};
 expect(()=>jobAddressLabel(postcode,'')).toThrow(/house number\/name and street/);
 expect(()=>jobAddressLabel(postcode,'12')).toThrow(/house number\/name and street/);
 expect(jobAddressLabel(postcode,'  14   High Street  ')).toBe('14 High Street, SW1A 1AA, Westminster, United Kingdom');
 expect(()=>jobAddressLabel({...postcode,label:'A'.repeat(160)},'B'.repeat(100))).toThrow(/too long/);
 expect(jobAddressLabel({...postcode,precision:'address',label:'14 High Street, London'},'')).toBe('14 High Street, London');
 expect(postcode.latitude).toBe(51.501);
 expect(postcode.precision).toBe('postcode');
});

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

test('Ambiguous address lookup never silently chooses the first house',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({suggestions:[
   {label:'10 Example Street, London',latitude:51.5,longitude:-0.1,postcode:'SW1A 1AA',precision:'address',country:'GB'},
   {label:'12 Example Street, London',latitude:51.5001,longitude:-0.1,postcode:'SW1A 1AA',precision:'address',country:'GB'}
  ]})});
 });
 await page.goto('/services');
 await page.getByLabel('Your postcode or street address').fill('Example Street London');
 await expect(page.getByRole('option',{name:/10 Example Street/})).toBeVisible();
 await page.getByRole('button',{name:'Find address'}).click();
 await expect(page.getByText('Choose your exact address from the suggestions below.')).toBeVisible();
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await page.getByRole('option',{name:/12 Example Street/}).click();
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('12 Example Street');
});

test('Address search endpoint rejects invalid input without leaking an API key',async({request})=>{
 const response=await request.post('/api/address/search',{data:{query:'X'}});
 expect(response.status()).toBe(400);
 const body=await response.json() as {suggestions:unknown[];message:string};
 expect(body.suggestions).toHaveLength(0);
 expect(JSON.stringify(body)).not.toContain('GEOAPIFY_API_KEY');
});

test('Address lookup is not a nested form and Enter cannot publish a job',async({page})=>{
 await page.goto('/jobs?trade=plumbing');
 // Anonymous customers are redirected before the protected job form renders.
 await expect(page).toHaveURL(/\/account\?next=/);
 // The shared address finder uses an explicit button, not a nested form,
 // so the customer job form can own submission and validation.
 await page.goto('/services');
 const search=page.getByRole('search',{name:''}).filter({has:page.getByLabel('Your postcode or street address')});
 await expect(search.locator('form')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Find address'})).toHaveAttribute('type','button');
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


test('Mobile TrustFive navigation reveals account and community routes without sideways scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const menu=page.getByRole('button',{name:'Open navigation menu'});
 await expect(menu).toBeVisible();
 await expect(menu).toHaveAttribute('aria-expanded','false');
 await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeHidden();
 await menu.click();
 await expect(page.getByRole('button',{name:'Close navigation menu'})).toHaveAttribute('aria-expanded','true');
 const mobile=page.getByRole('navigation',{name:'Mobile navigation'});
 await expect(mobile).toBeVisible();
 await expect(mobile.getByRole('link',{name:'Find a professional'})).toBeVisible();
 await expect(mobile.getByRole('link',{name:'My dashboard'})).toBeVisible();
 await expect(mobile.getByRole('link',{name:'Groups'})).toHaveCount(0);
 await expect(mobile.getByRole('link',{name:'Notifications'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await mobile.getByRole('link',{name:'Find a professional'}).click();
 await expect(page).toHaveURL(/\/services$/);
 await expect(page.getByRole('button',{name:'Open navigation menu'})).toHaveAttribute('aria-expanded','false');
});

test('Booking address lookups isolate an unavailable private-address RPC without hiding bookings',async()=>{
 const started:string[]=[];
 const result=await loadBookingSiteBatch(['own','revoked','offline','other'],async id=>{
  started.push(id);
  if(id==='offline')throw new Error('Permission check unavailable');
  if(id==='revoked')return null;
  return {address_label:id==='own'?'Example Street, Test City':'Other authorised address'};
 },2);
 expect(started).toEqual(['own','revoked','offline','other']);
 expect(result.sites.own).toEqual({address_label:'Example Street, Test City'});
 expect(result.sites.revoked).toBeNull();
 expect(result.sites.offline).toBeNull();
 expect(result.unavailableIds).toEqual(['offline']);
 expect(result.sites.other).toEqual({address_label:'Other authorised address'});
});

test('Private booking address lookups have a strict concurrency limit',async()=>{
 let active=0,maxActive=0;
 const result=await loadBookingSiteBatch(['a','b','c','d','e','f','g'],async id=>{
  active+=1;maxActive=Math.max(maxActive,active);
  await Promise.resolve();
  active-=1;return id;
 },3);
 expect(maxActive).toBeLessThanOrEqual(3);
 expect(result.unavailableIds).toEqual([]);
 expect(Object.values(result.sites)).toHaveLength(7);
 await expect(loadBookingSiteBatch([],async()=>null,0)).rejects.toThrow('Invalid booking-site batch size');
});

test('Anonymous visitors cannot see private booking information',async({page})=>{
 await page.goto('/bookings');
 await expect(page).toHaveURL(/\/account\?next=/);
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

test('Only a pending quote attached to an open job can be confirmed',()=>{
 const jobs=[{id:'open-job',status:'open'},{id:'booked-job',status:'booked'},{id:'closed-job',status:'completed'}];
 const quotes=[
  {quote_id:'eligible',job_id:'open-job',status:'pending'},
  {quote_id:'already-declined',job_id:'open-job',status:'declined'},
  {quote_id:'already-booked',job_id:'booked-job',status:'pending'},
  {quote_id:'already-completed',job_id:'closed-job',status:'pending'}
 ];
 expect(canConfirmJobQuote('eligible',quotes,jobs)).toBe(true);
 for(const quote of ['already-declined','already-booked','already-completed','missing']){
  expect(canConfirmJobQuote(quote,quotes,jobs)).toBe(false);
 }
 expect(canConfirmJobQuote(null,quotes,jobs)).toBe(false);
 expect(canConfirmJobQuote('eligible',quotes,[])).toBe(false);
 expect(canConfirmJobQuote('eligible',[],jobs)).toBe(false);
});

test('Unauthenticated users cannot accept a TrustFive job quote',async({page})=>{
 await page.goto('/jobs');
 await expect(page).toHaveURL(/\/account\?next=/);
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

test('Marketplace deep links target the correct quote thread and booking without exposing addresses',()=>{
 const quoteId='2e57b536-5117-46b0-b583-c264cb2314cb';
 const bookingId='45e1e98a-8399-4f2c-b2c5-1ba707e7a302';
 expect(quoteMessagesHref(quoteId)).toBe('/messages?quote='+quoteId);
 expect(bookingScheduleHref(bookingId)).toBe('/schedule?booking='+bookingId);
 expect(bookingHistoryHref(bookingId)).toBe('/bookings?booking='+bookingId);
 for(const href of [quoteMessagesHref(quoteId),bookingScheduleHref(bookingId),bookingHistoryHref(bookingId)]){
  expect(href).not.toContain('postcode');
  expect(href).not.toContain('address');
 }
});

test('A URL alone never grants access to a private quote conversation or booking',()=>{
 const allowedQuotes=['own-quote-a','own-quote-b'];
 const allowedBookings=['own-booking'];
 expect(authorisedQuoteSelection('own-quote-b',allowedQuotes)).toBe('own-quote-b');
 expect(authorisedQuoteSelection('other-customer-quote',allowedQuotes)).toBe('');
 expect(authorisedQuoteSelection(null,allowedQuotes)).toBe('');
 expect(authorisedBookingSelection('own-booking',allowedBookings)).toBe('own-booking');
 expect(authorisedBookingSelection('other-booking',allowedBookings)).toBe('');
 expect(authorisedBookingSelection(null,allowedBookings)).toBe('');
});

test('Unauthenticated deep links cannot show a private conversation or appointment',async({page})=>{
 await page.goto('/messages?quote=other-customer-quote');
 await expect(page.getByRole('heading',{name:'TrustFive Messages'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sign in to view messages'})).toBeVisible();
 await expect(page.getByText('Other participant')).toHaveCount(0);
 await page.goto('/schedule?booking=other-customer-booking');
 await expect(page.getByRole('heading',{name:'Booking appointments'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sign in'})).toBeVisible();
});
