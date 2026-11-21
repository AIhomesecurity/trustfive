import {expect,test,type Page} from '@playwright/test';
import {SEARCH_LOCATION_HANDOFF_KEY} from '../../lib/search-location-handoff';

// Public UI fixtures only: real taxonomy slugs and no provider records. The
// directory must never imply an approved business exists just because a test
// stub returns an empty result set.
const tradeRows=[
 {id:'trade-plumbing',name:'Plumbing',slug:'plumbing'},
 {id:'trade-cctv',name:'CCTV and cameras',slug:'cctv-installation'},
 {id:'trade-security',name:'Home security',slug:'home-security'}
];
const areaRows=[{id:'area-test',area_name:'Test Central',city:'Test City',country_code:'GB'}];

async function stubCatalog(page:Page,areas=areaRows){
 await page.route('**/rest/v1/trades?*',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(tradeRows)
 }));
 await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(areas)
 }));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews*',route=>route.fulfill({
  status:200,contentType:'application/json',body:'[]'
 }));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_nearby*',route=>route.fulfill({
  status:200,contentType:'application/json',body:'[]'
 }));
}

test('Keyword search resolves alternative terms using the keyboard and keeps the trade',async({page})=>{
 await stubCatalog(page);
 await page.goto('/services');
 const search=page.getByRole('combobox',{name:'Search services by name or keyword'});
 await search.fill('plumbers');
 await expect(page.getByRole('listbox',{name:'Matching services'}).getByRole('option').filter({hasText:'Plumbing'})).toBeVisible();
 await search.press('Enter');
 await expect(page.getByLabel('Trade or service')).toHaveValue('trade-plumbing');
 await expect(page).toHaveURL(/trade=plumbing/);
 const jobHref=await page.getByRole('link',{name:'Describe your job'}).getAttribute('href');
 expect(jobHref).toContain('trade=plumbing');
 const next=await page.getByRole('link',{name:/Sign in to keep your trade and location/}).getAttribute('href')
  .then(value=>value?new URL(value,'http://127.0.0.1').searchParams.get('next'):null);
 expect(next).toContain('trade=plumbing');
 await page.getByLabel('Trade or service').selectOption('');
 await expect(search).toHaveValue('');
});

test('Area filter is visible, uses real areas and preserves trade and location into the job flow',async({page})=>{
 const rpcBodies:string[]=[];
 await stubCatalog(page);
 page.on('request',request=>{
  if(request.url().includes('/rest/v1/rpc/find_trustfive_professionals_with_reviews')&&request.postData()){
   rpcBodies.push(request.postData()||'');
  }
 });
 await page.goto('/services?trade=cctv-installation');
 await expect(page.getByLabel('Area or town')).toBeVisible();
 await page.getByLabel('Area or town').selectOption('area-test');
 await expect(page).toHaveURL(/trade=cctv-installation/);
 await expect(page).toHaveURL(/area=area-test/);
 await expect(rpcBodies.some(body=>body.includes('area-test'))).toBe(true);
 const jobHref=await page.getByRole('link',{name:'Describe your job'}).getAttribute('href');
 expect(jobHref).toContain('trade=cctv-installation');
 expect(jobHref).toContain('area=area-test');
 const nextHref=await page.getByRole('link',{name:/Sign in to keep your trade and location/}).getAttribute('href');
 const next=nextHref?new URL(nextHref,'http://127.0.0.1').searchParams.get('next'):null;
 expect(next).toContain('trade=cctv-installation');
 expect(next).toContain('area=area-test');
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(page).toHaveURL(/\/services$/);
 await expect(page.getByLabel('Area or town')).toHaveValue('');
 await expect(page.getByRole('combobox',{name:'Search services by name or keyword'})).toHaveValue('');
});

test('Unknown text is shown as text and an empty catalogue explains missing coverage',async({page})=>{
 await stubCatalog(page,[]);
 const injected='<img src=x onerror=alert(1)>';
 let dialogs=0;
 page.on('dialog',dialog=>{dialogs++;void dialog.dismiss();});
 await page.goto('/services?q='+encodeURIComponent(injected));
 const hint=page.getByRole('status').filter({hasText:'No exact category for'});
 await expect(hint).toContainText(injected);
 await expect(hint.locator('img')).toHaveCount(0);
 expect(dialogs).toBe(0);
 await expect(page.getByRole('status').filter({hasText:'No service areas are defined'})).toBeVisible();
 await expect(page.getByLabel('Area or town')).toBeDisabled();
});

test('Service suggestions open with arrow keys, select with Enter, close with Escape and fit 360px',async({page})=>{
 await stubCatalog(page);
 await page.setViewportSize({width:360,height:780});
 await page.goto('/services');
 const search=page.getByRole('combobox',{name:'Search services by name or keyword'});
 const tradeSelect=page.getByLabel('Trade or service');
 const listbox=page.getByRole('listbox',{name:'Matching services'});
 await search.fill('security');
 await expect(listbox.getByRole('option')).toHaveCount(2);
 await expect(search).toHaveAttribute('aria-expanded','true');
 await search.press('ArrowDown');
 await expect(listbox.getByRole('option').nth(0)).toHaveAttribute('aria-selected','true');
 await expect(search).toHaveAttribute('aria-activedescendant',/-option-0$/);
 await search.press('ArrowDown');
 await expect(listbox.getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');
 await search.press('Enter');
 await expect(tradeSelect).toHaveValue('trade-security');
 await expect(search).toBeFocused();
 await expect(listbox).toHaveCount(0);

 await search.fill('security');
 await expect(listbox.getByRole('option')).toHaveCount(2);
 await search.press('ArrowUp');
 await expect(listbox.getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');
 await search.press('Escape');
 await expect(listbox).toHaveCount(0);
 await expect(search).toHaveAttribute('aria-expanded','false');
 await expect(search).toBeFocused();

 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow,{message:'Unexpected horizontal overflow at 360px'}).toBeLessThanOrEqual(1);
});

test('Selected address is carried in tab storage and kept out of job and sign-in URLs',async({page})=>{
 await stubCatalog(page);
 await page.route('**/api/address/search',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({suggestions:[{
   label:'18 Example Street, Test City',latitude:51.5,longitude:-0.14,
   postcode:'SW1A 1AA',precision:'address',country:'GB'
  }]})
 }));
 await page.goto('/services?trade=cctv-installation');
 await page.getByLabel('Your postcode or street address').fill('18 Example Street, Test City');
 await page.getByRole('option',{name:/18 Example Street/}).click();
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('18 Example Street');
 const raw=await page.evaluate(key=>sessionStorage.getItem(key),SEARCH_LOCATION_HANDOFF_KEY);
 expect(raw).toBeTruthy();
 expect(JSON.parse(raw||'{}')).toMatchObject({label:'18 Example Street, Test City',precision:'address',country:'GB'});
 expect(page.url()).not.toContain('Example');
 const jobHref=await page.getByRole('link',{name:'Describe your job'}).getAttribute('href');
 expect(jobHref).toContain('trade=cctv-installation');
 expect(jobHref).not.toContain('address');
 const nextHref=await page.getByRole('link',{name:/Sign in to keep your trade and location/}).getAttribute('href');
 const next=nextHref?new URL(nextHref,'http://127.0.0.1').searchParams.get('next'):null;
 expect(next).toContain('trade=cctv-installation');
 expect(next).not.toContain('Example');
});
