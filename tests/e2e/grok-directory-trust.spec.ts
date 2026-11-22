import {expect,test,type Page,type Route} from '@playwright/test';

const CUSTOMER_HOME='14 Private Customer Lane, SW1A 9ZZ';
const TRADE_ID='11111111-1111-4111-8111-111111111111';
const OTHER_TRADE_ID='22222222-2222-4222-8222-222222222222';
const AREA_ID='33333333-3333-4333-8333-333333333333';
const PRO_ID='44444444-4444-4444-8444-444444444444';

const trades=[
 {id:TRADE_ID,name:'Plumbing',slug:'plumbing'},
 {id:OTHER_TRADE_ID,name:'Electrical',slug:'electrical'}
];
const areas=[{id:AREA_ID,area_name:'Example Quarter',city:'Testville',country_code:'GB'}];

const listedProfessional={
 application_id:PRO_ID,
 business_name:'Fixture Plumbing Co',
 about:'Independently approved local plumbing business',
 trade_name:'Plumbing',
 area_name:'Example Quarter',
 city:'Testville',
 quality_score:82,
 slot:1,
 average_stars:0,
 review_count:0,
 customer_home_address:CUSTOMER_HOME,
 customer_address:CUSTOMER_HOME
};

function cors(){
 return {
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'*',
  'access-control-allow-methods':'GET,POST,PATCH,OPTIONS',
  'content-type':'application/json'
 };
}

async function fulfill(route:Route,body:unknown){
 await route.fulfill({status:200,headers:cors(),body:JSON.stringify(body)});
}

const CCTV_ID='55555555-5555-4555-8555-555555555555';
const cctvTrade={id:CCTV_ID,name:'CCTV & security camera installation',slug:'cctv-installation'};

async function stubDirectory(page:Page,professionals:unknown[],catalog:typeof trades=trades){
 await page.route('**/*supabase.co/**',async route=>{
  const request=route.request();
  const url=request.url();
  if(request.method()==='OPTIONS'){
   await route.fulfill({status:204,headers:cors()});
   return;
  }
  if(url.includes('/rest/v1/trades')){await fulfill(route,catalog);return;}
  if(url.includes('/rest/v1/service_areas')){await fulfill(route,areas);return;}
  if(url.includes('/rest/v1/rpc/')){await fulfill(route,professionals);return;}
  if(url.includes('/auth/v1/')){await fulfill(route,{});return;}
  await fulfill(route,[]);
 });
}

test('Public directory loads without a customer account and states the five-slot rule honestly',async({page})=>{
 await stubDirectory(page,[]);
 await page.goto('/services');
 await expect(page).toHaveURL(/\/services/);
 await expect(page.getByRole('heading',{name:'Find a TrustFive professional'})).toBeVisible();
 await expect(page.getByText('Up to five approved professionals')).toBeVisible();
 await expect(page.getByText(/only when they qualify/i)).toBeVisible();
 await expect(page.getByRole('complementary',{name:'How TrustFive selects professionals'})).toContainText(/cannot pay to enter the five approved places/i);
 const intro=(await page.locator('.directory-intro').innerText()).replace(/\s+/g,' ');
 expect(intro).not.toMatch(/available in every/i);
 expect(intro).not.toMatch(/five professionals are available/i);
 expect(intro).toMatch(/Up to five/i);
});

test('Empty directory results explain the gap instead of inventing listings',async({page})=>{
 await stubDirectory(page,[]);
 await page.goto('/services');
 await expect(page.getByLabel('Trade or service')).toBeEnabled();
 await page.getByLabel('Trade or service').selectOption(TRADE_ID);
 await expect(page.getByRole('status').filter({hasText:'No approved professionals for this trade yet'})).toBeVisible();
 await expect(page.getByText('There are no currently approved results for this trade')).toBeVisible();
 await expect(page.getByText(/we will not invent|No demo listings|will not fill gaps/i)).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Fixture Plumbing Co'})).toHaveCount(0);
 await expect(page.getByText('0 approved professionals matching your filters')).toBeVisible();
});

test('Trade filters are usable and fixture customer home addresses stay off the public directory',async({page})=>{
 await stubDirectory(page,[listedProfessional]);
 await page.goto('/services');
 const trade=page.getByLabel('Trade or service');
 await expect(trade).toBeEnabled();
 await expect(trade.locator('option',{hasText:'Plumbing'})).toHaveCount(1);
 await expect(trade.locator('option',{hasText:'Electrical'})).toHaveCount(1);
 await expect(page.getByLabel('Filter professionals')).toBeVisible();
 await expect(page.getByRole('button',{name:'Clear filters'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Fixture Plumbing Co'})).toBeVisible();
 await expect(page.getByText('TrustFive approved')).toBeVisible();
 await expect(page.locator('body')).not.toContainText(CUSTOMER_HOME);
 await expect(page.locator('body')).not.toContainText('Private Customer Lane');
});

test('CCTV search selects that trade and an uncovered area stays honestly empty',async({page})=>{
 await stubDirectory(page,[],[...trades,cctvTrade]);
 await page.goto('/services?q=cctv&area='+AREA_ID);
 const trade=page.getByLabel('Trade or service');
 await expect(trade).toBeEnabled();
 await expect(trade).toHaveValue(CCTV_ID);
 await expect(page.getByRole('heading',{name:'CCTV & security camera installation'})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'No approved professionals for this trade in the selected area yet'})).toBeVisible();
 await expect(page.getByText('We will not invent a top five.')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Fixture Plumbing Co'})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText(CUSTOMER_HOME);
});

test('Directory layout does not overflow a 360px screen',async({page})=>{
 await stubDirectory(page,[listedProfessional]);
 await page.setViewportSize({width:360,height:800});
 await page.goto('/services');
 await expect(page.getByRole('heading',{name:'Find a TrustFive professional'})).toBeVisible();
 await expect(page.getByLabel('Trade or service')).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
});
