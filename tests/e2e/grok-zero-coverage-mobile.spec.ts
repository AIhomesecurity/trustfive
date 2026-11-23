import {expect,test,type Page,type Route} from '@playwright/test';

const CCTV='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SECURITY='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const HOME='14 Private Customer Lane, London';
const trades=[
 {id:CCTV,name:'CCTV & security camera installation',slug:'cctv-installation'},
 {id:SECURITY,name:'Home security',slug:'home-security'}
];
const approved={
 application_id:'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
 business_name:'Fixture CCTV Co',about:'Approved installer',trade_name:'CCTV & security camera installation',
 area_name:'Example Quarter',city:'Testville',quality_score:80,slot:1,average_stars:0,review_count:0,
 distance_km:1.2,customer_home_address:HOME
};
const waiting={...approved,application_id:'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',business_name:'Waiting List Alarms',slot:0,status:'waiting',trade_name:'Home security'};

function cors(){
 return {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS','content-type':'application/json'};
}
async function json(route:Route,body:unknown,status=200){
 await route.fulfill({status,headers:cors(),body:JSON.stringify(body)});
}

test('360px CCTV journey separates zero coverage from an outage and keeps the address private',async({page})=>{
 let nearbyFailures=0;
 await page.setViewportSize({width:360,height:800});
 await page.route('**/*supabase.co/**',async route=>{
  const url=route.request().url();
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors()});return;}
  if(url.includes('/rest/v1/trades')){await json(route,trades);return;}
  if(url.includes('/rest/v1/service_areas')){await json(route,[]);return;}
  if(url.includes('/rest/v1/rpc/')){
   const body=route.request().postDataJSON() as {p_lat?:number|null}|null;
   if(body&&typeof body.p_lat==='number'){
    nearbyFailures+=1;
    if(nearbyFailures===1){await json(route,{message:'Directory search is temporarily unavailable',code:'500'},500);return;}
    await json(route,[waiting]);
    return;
   }
   await json(route,{message:'Directory search is temporarily unavailable',code:'500'},500);
   return;
  }
  await json(route,[]);
 });
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[{label:'SW1A 1AA, Westminster, United Kingdom',latitude:51.501,longitude:-0.141,postcode:'SW1A 1AA',precision:'postcode',country:'GB'}]
  })});
 });
 await page.goto('/services?q=cctv');
 await expect(page.getByLabel('Trade or service')).toHaveValue(CCTV);
 await expect(page.getByRole('alert').filter({hasText:'Professional search unavailable'})).toBeVisible();
 await expect(page.getByText(/0 approved professionals/)).toHaveCount(0);
 await expect(page.getByRole('status').filter({hasText:'No approved professionals near this address yet'})).toHaveCount(0);
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('SW1A 1AA');
 const option=page.getByRole('option',{name:/SW1A 1AA/});
 await option.focus();
 await page.keyboard.press('Enter');
 await expect(page.getByText('Distance uses an approximate postcode or district centre, not your exact property.')).toBeVisible();
 await expect(page.getByRole('alert').filter({hasText:'Professional search unavailable'})).toBeVisible();
 await page.getByRole('button',{name:'Try searching again'}).click();
 await expect(page.getByRole('status').filter({hasText:'No approved professionals near this address yet'})).toBeVisible();
 await expect(page.getByText('We will not fill gaps with unvetted listings.')).toBeVisible();
 await expect(page.getByRole('alert').filter({hasText:'Professional search unavailable'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Waiting List Alarms'})).toHaveCount(0);
 await expect(page.getByText('0 approved professionals matching your filters')).toBeVisible();
 await expect(page.getByRole('link',{name:'Describe your job'})).toHaveAttribute('href','/jobs?trade=cctv-installation');
 await expect(page.getByRole('link',{name:'Post your job'})).toHaveAttribute('href','/jobs?trade=cctv-installation');
 expect(page.url()).not.toContain('Private');
 expect(page.url()).not.toContain('SW1A');
 expect(page.url()).toMatch(/trade=cctv-installation|q=cctv/);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
});

test('Alarm synonym selects home security and does not list a waiting professional',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.route('**/*supabase.co/**',async (route:Route)=>{
  const url=route.request().url();
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors()});return;}
  if(url.includes('/rest/v1/trades')){await json(route,trades);return;}
  if(url.includes('/rest/v1/service_areas')){await json(route,[]);return;}
  if(url.includes('/rest/v1/rpc/')){await json(route,[{...approved,business_name:'Fixture Alarm Co',trade_name:'Home security'},waiting]);return;}
  await json(route,[]);
 });
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[{label:'BT1 postcode district, Belfast, United Kingdom',latitude:54.6,longitude:-5.93,postcode:null,precision:'postcode',country:'GB'}]
  })});
 });
 await page.goto('/services?q=alarm');
 await expect(page.getByLabel('Trade or service')).toHaveValue(SECURITY);
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('BT1');
 await page.getByRole('option',{name:/BT1 postcode district/}).focus();
 await page.keyboard.press('Enter');
 await expect(page.getByText('Distance uses an approximate postcode or district centre, not your exact property.')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Fixture Alarm Co'})).toBeVisible();
 await expect(page.getByText('1.2 km')).toBeVisible();
 await expect(page.getByText('approximate distance')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Waiting List Alarms'})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText(HOME);
 await expect(page.getByRole('link',{name:'Post a job'})).toHaveAttribute('href','/jobs?trade=home-security');
 expect(page.url()).not.toContain('BT1');
});
