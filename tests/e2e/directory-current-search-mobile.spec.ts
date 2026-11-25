import {expect,test} from '@playwright/test';

test.use({viewport:{width:360,height:740},isMobile:true,hasTouch:true});

test('mobile comparison hides stale approval and distinguishes a failed search from zero coverage',async({page})=>{
 const id='00000000-0000-4000-8000-000000000001';
 await page.addInitScript(id=>localStorage.setItem('trustfive-shortlist-v1',JSON.stringify([id])),id);
 await page.route('**/rest/v1/trades?*',route=>route.fulfill({json:[
  {id:'fixture-cctv',name:'CCTV installation',slug:'cctv-installation'},
  {id:'fixture-security',name:'Home security',slug:'home-security'},
 ]}));
 await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({json:[]}));
 const requestedTrades:(string|null)[]=[];
 let finishFailure=()=>{};
 const holdFailure=new Promise<void>(resolve=>{finishFailure=resolve;});
 let securityRequests=0;
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews',async route=>{
  const {p_trade}=route.request().postDataJSON();
  requestedTrades.push(p_trade);
  if(p_trade==='fixture-cctv')return route.fulfill({json:[{
   application_id:id,business_name:'Synthetic CCTV business',trade_name:'CCTV installation',
   area_name:'Synthetic area',city:'Synthetic city',quality_score:90,slot:1,review_count:2,average_stars:4.5,
  }]});
  if(p_trade==='fixture-security'&&++securityRequests===1){
   await holdFailure;
   return route.fulfill({status:503,json:{message:'Synthetic outage'}});
  }
  return route.fulfill({json:[]});
 });

 try{
  await page.goto('/services?q=CCTV');
  const comparison=page.getByRole('region',{name:'Compare approved professionals'});
  await expect(comparison.getByText('Currently approved in these results')).toBeVisible();
  expect(requestedTrades).toEqual(['fixture-cctv']);

  await page.getByLabel('Trade or service').selectOption('fixture-security');
  await expect(comparison.getByText('Checking which saved professionals match this search…')).toBeVisible();
  await expect(comparison.getByText('Currently approved in these results')).toHaveCount(0);
  finishFailure();
  await expect(page.getByText('Professional search unavailable.',{exact:false})).toBeVisible();
  await expect(page.getByText('0 approved professionals matching your filters')).toHaveCount(0);
  await expect(comparison.getByText('Current eligibility could not be checked.')).toBeVisible();

  await page.getByRole('button',{name:'Try searching again'}).press('Enter');
  await expect(page.getByRole('heading',{name:'Home security',exact:true})).toBeFocused();
  await expect(page.getByText('0 approved professionals matching your filters')).toBeVisible();
  await expect(page.getByRole('heading',{name:'No approved professionals for this trade yet'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Post your job'})).toHaveAttribute('href','/jobs?trade=home-security');
 }finally{finishFailure();}
});

test('mobile result job links use the listed trade when browsing all services',async({page})=>{
 await page.route('**/rest/v1/trades?*',route=>route.fulfill({json:[
  {id:'fixture-cctv',name:'CCTV installation',slug:'cctv-installation'},
 ]}));
 await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews',route=>route.fulfill({json:[{
  application_id:'00000000-0000-4000-8000-000000000011',
  business_name:'Synthetic camera installer',trade_name:'CCTV installation',
  area_name:'Synthetic area',city:'Synthetic city',quality_score:90,slot:1,review_count:0,average_stars:0,
 }]}));
 await page.goto('/services');
 const result=page.getByRole('article').filter({hasText:'Synthetic camera installer'});
 await expect(result.getByRole('link',{name:'Post a job'})).toHaveAttribute('href','/jobs?trade=cctv-installation');
 await expect(page.getByRole('link',{name:'Describe your job'})).toHaveAttribute('href','/jobs');

 const compare=result.getByRole('button',{name:/Compare|In comparison/i});
 await compare.press('Enter');
 await page.getByRole('button',{name:'Remove from comparison'}).press('Enter');
 await expect(compare).toBeFocused();
 await expect(compare).toHaveAttribute('aria-pressed','false');
 await compare.press('Enter');
 await page.getByRole('button',{name:'Clear comparison'}).press('Enter');
 await expect(page.getByLabel('Sort results')).toBeFocused();
 await expect(page.getByRole('region',{name:'Compare approved professionals'})).toHaveCount(0);
});

test('mobile catalog retry preserves keyboard focus and resolves an alarm search',async({page})=>{
 let catalogUnavailable=true;
 const searchedTrades:string[]=[];
 await page.route('**/rest/v1/trades?*',route=>{
  if(catalogUnavailable)return route.fulfill({status:400,json:{message:'Synthetic catalog read failure'}});
  return route.fulfill({json:[{id:'fixture-security',name:'Home security',slug:'home-security'}]});
 });
 await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews',route=>{
  searchedTrades.push(route.request().postDataJSON().p_trade);
  return route.fulfill({json:[]});
 });

 await page.goto('/services?q=burglar+alarm');
 const retry=page.getByRole('button',{name:'Retry service filters'});
 await expect(retry).toBeVisible();
 expect(searchedTrades).toEqual([]);
 catalogUnavailable=false;
 await retry.press('Enter');
 await expect(page.getByRole('heading',{name:'Home security',exact:true})).toBeFocused();
 await expect(page.getByRole('link',{name:'Post your job'})).toHaveAttribute('href','/jobs?trade=home-security');
 expect(searchedTrades).toEqual(['fixture-security']);
});
