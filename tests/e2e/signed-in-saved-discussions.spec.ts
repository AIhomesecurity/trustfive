import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';

const backend='http://127.0.0.1:54321';
const app='http://127.0.0.1:3112';
const user={id:'aaaaaaaa-0000-4000-8000-000000000010',aud:'authenticated'};
const token='synthetic-saved-discussions-token';
const published='bbbbbbbb-0000-4000-8000-000000000010';
const hidden='bbbbbbbb-0000-4000-8000-000000000011';
const created='2026-11-23T00:00:00Z';

test.use({viewport:{width:360,height:740},isMobile:true,hasTouch:true});
test('signed-in mobile saved discussions recover a load and local events recover without a reload',async({page})=>{
 test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL!==backend,'Requires the isolated loopback application build.');
 test.setTimeout(60000);
 page.setDefaultTimeout(10000);
 let removes=0;
 let areaFailuresRemaining=0;
 let failDiscovery=false;
 let failComments=true;
 let failFeed=false;
 let bookmarkFailures=2;
 const fixture=createServer((request,response)=>{
  const url=new URL(request.url??'/',backend);
  const reply=(status:number,data:unknown)=>{
   response.writeHead(status,{
    'access-control-allow-origin':'*','access-control-allow-headers':'*',
    'access-control-allow-methods':'GET,DELETE,OPTIONS','content-type':'application/json',
   });
   response.end(status===204?'':JSON.stringify(data));
  };
  if(request.method==='OPTIONS')return reply(204,null);
  if(request.headers.authorization!=='Bearer '+token)return reply(401,{message:'Synthetic session required'});
  if(url.pathname==='/auth/v1/user')return reply(200,user);
  if(url.pathname==='/rest/v1/service_areas'&&areaFailuresRemaining>0){
   areaFailuresRemaining--;
   return reply(500,{message:'Synthetic neighbourhood outage'});
  }
  if(url.pathname==='/rest/v1/community_events'&&url.searchParams.get('limit')==='60'&&failDiscovery){
   failDiscovery=false;
   return reply(500,{message:'Synthetic event discovery outage'});
  }
  if(url.pathname==='/rest/v1/community_comments'&&failComments){
   failComments=false;
   return reply(500,{message:'Synthetic discussion read outage'});
  }
  if(url.pathname==='/rest/v1/social_saved_posts'){
   if(url.searchParams.get('user_id')!=='eq.'+user.id)return reply(403,{message:'Unexpected account'});
   if(request.method==='DELETE'){
    if(url.searchParams.get('post_id')!=='eq.'+published||removes)return reply(400,{message:'Unexpected removal'});
    removes++;
    return reply(200,{post_id:published});
   }
   if(url.searchParams.get('post_id')==='eq.'+published)return reply(200,[]);
   if(bookmarkFailures>0){bookmarkFailures--;return reply(500,{message:'Synthetic bookmark load failure'});}
   return reply(200,[...(removes?[]:[{post_id:published,saved_at:created}]),{post_id:hidden,saved_at:created}]);
  }
  if(url.pathname==='/rest/v1/community_posts'&&url.searchParams.get('id')==='eq.'+published){
   return reply(200,[{id:published,body:'Synthetic published saved post',area_id:null,visibility:'published',created_at:created}]);
  }
  if(failFeed&&url.pathname==='/rest/v1/community_posts'){
   failFeed=false;
   return reply(503,{message:'Synthetic feed outage'});
  }
  if(url.pathname==='/rest/v1/community_posts')return reply(200,[
   {id:published,body:'Synthetic published saved post',area_id:null,visibility:'published',created_at:created},
   {id:hidden,body:'Synthetic hidden saved post',area_id:null,visibility:'hidden',created_at:created},
  ]);
  return reply(200,[]);
 });
 // The authenticated Social browser fixtures share the loopback backend port.
 for(let attempt=0;;attempt++){
  try{await once(fixture.listen(54321,'127.0.0.1'),'listening');break;}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='EADDRINUSE'||attempt>=80)throw error;
   await delay(250);
  }
 }
 try{
  const session={access_token:token,refresh_token:'synthetic-refresh',
   expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
  await page.context().addCookies([{name:'sb-127-auth-token',
   value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:app}]);
  await page.goto('/community/social?tab=saved');
  const saved=page.getByRole('region',{name:'My saved discussions'});
  await expect(saved.getByRole('alert')).toContainText('Could not load your saved discussions');
  const retryBookmarks=saved.getByRole('button',{name:'Retry loading bookmarks'});
  await retryBookmarks.press('Enter');
  await expect(retryBookmarks).toBeFocused();
  await retryBookmarks.press('Enter');
  await expect(saved.getByText('Synthetic published saved post')).toBeVisible();
  await expect(saved.getByRole('button',{name:'Refresh saved discussions'})).toBeFocused();
  await expect(saved.getByText('Synthetic hidden saved post')).toHaveCount(0);
  await saved.getByRole('button',{name:'Remove bookmark'}).press('Enter');
  await expect(saved.getByText('Removed from your private saved posts.')).toBeFocused();
  await expect(saved.getByText('Synthetic published saved post')).toHaveCount(0);
  await expect(saved.getByRole('link',{name:'neighbourhood feed'})).toHaveAttribute('href','/community/social');
  expect(removes).toBe(1);

  areaFailuresRemaining=2;
  await page.goto('/community/events');
  const retryEvents=page.getByRole('button',{name:'Retry loading local events'});
  await expect(page.getByRole('alert').filter({has:retryEvents})).toContainText('We could not check your account or load neighbourhoods');
  await page.evaluate(()=>{document.documentElement.dataset.syntheticEventsDocument='initial';});
  await retryEvents.press('Enter');
  await expect(retryEvents).toBeFocused();
  await retryEvents.press('Enter');
  await expect(page.getByRole('heading',{name:'Local events'})).toBeFocused();
  await expect(page.getByRole('heading',{name:'Upcoming events'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-synthetic-events-document','initial');

  failDiscovery=true;
  await page.goto('/community/social?tab=events');
  const discovery=page.getByRole('region',{name:'Community events'});
  await discovery.getByRole('button',{name:'Retry events'}).press('Enter');
  await expect(discovery.getByRole('button',{name:'Refresh events'})).toBeFocused();
  await expect(discovery.getByText('0 matching upcoming events',{exact:false})).toBeVisible();

  await page.goto('/community/posts/'+published);
  await page.getByRole('button',{name:'Read and reply'}).press('Enter');
  const retryDiscussion=page.getByRole('button',{name:'Retry discussion'});
  await expect(retryDiscussion).toBeVisible();
  await retryDiscussion.press('Enter');
  await expect(page.getByRole('button',{name:'Hide discussion'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Refresh discussion'})).toBeVisible();

  failFeed=true;
  await page.goto('/community');
  await page.getByRole('button',{name:'Try loading posts again'}).press('Enter');
  await expect(page.getByRole('heading',{name:'Neighbourhood feed'})).toBeFocused();
  await expect(page.getByText('Synthetic published saved post',{exact:true})).toBeVisible();
 }finally{
  await new Promise<void>((resolve,reject)=>{
   fixture.close(error=>error?reject(error):resolve());
   fixture.closeAllConnections();
  });
 }
});
