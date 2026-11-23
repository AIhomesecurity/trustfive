import {expect,test} from '@playwright/test';

test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});

for(const [query,trade] of [['C.C.T.V.','fixture-cctv'],['Alarm','fixture-security'],['Intruder alarms','fixture-security']]){
 test(`mobile directory resolves ${query} to the matching catalogue trade`,async({page})=>{
  await page.route('**/rest/v1/trades?*',route=>route.fulfill({json:[
   {id:'fixture-cctv',name:'CCTV installation',slug:'cctv-installation'},
   {id:'fixture-security',name:'Home security',slug:'home-security'}
  ]}));
  await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({json:[]}));
  await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews',route=>route.fulfill({json:[]}));
  await page.goto('/services?q='+encodeURIComponent(query));
  await expect(page.getByLabel('Trade or service')).toHaveValue(trade);
  await expect(page.getByRole('link',{name:'Describe your job'})).toHaveAttribute('href',
   '/jobs?trade='+(trade==='fixture-cctv'?'cctv-installation':'home-security'));
  await expect(page.getByText('No exact category for',{exact:false})).toHaveCount(0);
 });
}
