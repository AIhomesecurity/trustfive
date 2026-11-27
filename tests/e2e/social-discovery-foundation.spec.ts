import {expect,test} from '@playwright/test';
import {findSocialArea,readablePostDate,selectSocialPosts,type SocialPostSummary} from '../../lib/social-discovery';

const rows:SocialPostSummary[]=[
 {id:'a',area_id:'north',body:'CCTV advice please',visibility:'published',created_at:'2026-11-20T12:00:00Z'},
 {id:'b',area_id:'south',body:'Neighbourhood garden help',visibility:'published',created_at:'2026-11-21T12:00:00Z'},
 {id:'c',area_id:'north',body:'Private draft',visibility:'draft',created_at:'2026-11-21T15:00:00Z'},
 {id:'d',area_id:'north',body:'Removed content',visibility:'removed',created_at:'2026-11-21T14:00:00Z'},
 {id:'e',area_id:'north',body:'Invalid date',visibility:'published',created_at:'nonsense'}
];

test('shows only published, dated genuine posts and keeps newest ordering',()=>{
 expect(selectSocialPosts(rows,{areaId:'',query:'',order:'recent'}).map(p=>p.id)).toEqual(['b','a']);
 expect(selectSocialPosts(rows,{areaId:'',query:'',order:'oldest'}).map(p=>p.id)).toEqual(['a','b']);
});

test('combines area, keyword, and bounded count without inferring topic verification',()=>{
 expect(selectSocialPosts(rows,{areaId:'north',query:'  cCtV  ',order:'recent'}).map(p=>p.id)).toEqual(['a']);
 expect(selectSocialPosts(rows,{areaId:'south',query:'cctv',order:'recent'})).toEqual([]);
 expect(selectSocialPosts(rows,{areaId:'',query:'',order:'recent',limit:1}).map(p=>p.id)).toEqual(['b']);
 expect(findSocialArea([{id:'north',area_name:'North',city:'Leeds'}],'unknown')).toBeUndefined();
 expect(readablePostDate('not-a-date')).toBe('Date unavailable');
});

test.describe('TrustFive Social anonymous route boundary',()=>{
 test.use({storageState:{cookies:[],origins:[]}});
 test('community is absent from public desktop and mobile navigation',async({page})=>{
  await page.goto('/');
  const desktop=page.getByRole('navigation',{name:'Main navigation'});
  await expect(desktop.getByRole('link',{name:'Community',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Open navigation menu'}).click();
  const mobile=page.getByRole('navigation',{name:'Mobile navigation'});
  await expect(mobile.getByRole('link',{name:'Community',exact:true})).toHaveCount(0);
  await expect(mobile.getByRole('link',{name:'Log in'})).toHaveAttribute('href','/account?mode=signin&next=%2Fdashboard');
 });
 test('protected social route redirects signed-out members without rendering a fake feed',async({page})=>{
  await page.goto('/community/social');
  await expect(page).toHaveURL(/\/account\?next=%2Fdashboard(?:&|$)/);
  await expect(page.getByRole('heading',{name:'TrustFive Social'})).toHaveCount(0);
 });
 test('community sign-in completes at the dashboard before members enter a section',async({page})=>{
  await page.goto('/community/social?tab=events');
  await expect(page).toHaveURL(url=>url.pathname==='/account'&&url.searchParams.get('next')==='/dashboard');
 });
 test('360px anonymous social entry does not overflow',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('/community/social');
  await expect(page).toHaveURL(/\/account\?next=%2Fdashboard(?:&|$)/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
 });
});
