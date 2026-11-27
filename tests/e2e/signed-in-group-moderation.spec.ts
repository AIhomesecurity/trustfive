import {createServer} from 'node:http';
import {expect,test,type Page} from '@playwright/test';

const backend='http://127.0.0.1:54321';
const groupId='aaaaaaaa-0000-4000-8000-000000000001';
const otherGroup='aaaaaaaa-0000-4000-8000-000000000002';
const member='bbbbbbbb-0000-4000-8000-000000000001';
const outsider='bbbbbbbb-0000-4000-8000-000000000002';
const moderator='bbbbbbbb-0000-4000-8000-000000000003';
const author='bbbbbbbb-0000-4000-8000-000000000004';
const time='2026-11-22T10:00:00Z';
const posts=[
 {id:'cccccccc-0000-4000-8000-000000000001',group_id:groupId,author_id:author,body:'Synthetic post to hide',created_at:time,visibility:'published'},
 {id:'cccccccc-0000-4000-8000-000000000002',group_id:groupId,author_id:author,body:'Synthetic post to keep',created_at:time,visibility:'published'},
];
type Report={id:string;category:string;explanation:string|null;created_at:string;post_body:string;post_id:string};
const user=(id:string)=>({id,aud:'authenticated'});

async function signIn(page:Page,id:string){
 const session={access_token:id,refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,
  expires_in:3600,token_type:'bearer',user:user(id)};
 await page.context().addCookies([{name:'sb-127-auth-token',
  value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:'http://127.0.0.1:3112'}]);
}

test('signed-in mobile reporting, moderation and cross-group UI use the existing routes',async({browser})=>{
 test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL!==backend,'Requires the isolated loopback application build.');
 const reports:Report[]=[];
 let failNextReport=true;
 const decisions:string[]=[];
 let outsiderPostReads=0;
 const fixture=createServer(async(request,response)=>{
  const url=new URL(request.url??'/',backend);
  const id=request.headers.authorization?.replace(/^Bearer /,'')??'';
  const reply=(status:number,data:unknown)=>{
   response.writeHead(status,{
    'access-control-allow-origin':'*','access-control-allow-headers':'*',
    'access-control-allow-methods':'GET,POST,OPTIONS','content-type':'application/json',
   });
   response.end(status===204?'':JSON.stringify(data));
  };
  if(request.method==='OPTIONS')return reply(204,null);
  if(![member,outsider,moderator].includes(id))return reply(401,{message:'Synthetic session required'});
  if(url.pathname==='/auth/v1/user')return reply(200,user(id));
  const type=url.pathname.split('/').pop();
  if(type==='community_groups'){
   const requested=url.searchParams.get('id')?.slice(3);
   return reply(200,[{id:requested,name:'Synthetic neighbours',description:'A synthetic group for the moderation journey.',
    area_id:null,creator_id:author,visibility:'public',created_at:time}]);
  }
  if(type==='community_group_memberships'){
   const requested=url.searchParams.get('group_id')?.slice(3);
   const available=id===outsider?otherGroup:groupId;
   return reply(200,requested===available?[{group_id:available,user_id:id,role:'member'}]:[]);
  }
  if(type==='community_group_posts'){
   if(id===outsider)outsiderPostReads++;
   return reply(200,posts.filter(post=>id===member&&post.group_id===url.searchParams.get('group_id')?.slice(3)&&post.visibility==='published'));
  }
  if(type==='is_trustfive_admin')return reply(200,id===moderator);
  if(type==='pending_group_post_reports')return reply(id===moderator?200:403,id===moderator?reports:{message:'Forbidden'});
  if(type==='community_group_post_reports'||type==='moderate_group_post_report'){
   let raw='';
   for await(const chunk of request)raw+=chunk;
   const body=JSON.parse(raw);
   if(type==='community_group_post_reports'){
    const post=posts.find(item=>item.id===body.post_id&&item.visibility==='published');
    if(!post||id!==member||body.reporter_id!==member)return reply(403,{message:'Forbidden'});
    if(failNextReport){failNextReport=false;return reply(503,{message:'Synthetic report outage'});}
    reports.push({id:post.id,category:body.category,explanation:body.explanation,
     created_at:time,post_body:post.body,post_id:post.id});
    return reply(201,null);
   }
   const index=reports.findIndex(report=>report.id===body.p_report);
   if(id!==moderator||index<0||!['hide','dismiss'].includes(body.p_action))return reply(403,{message:'Forbidden'});
   const [report]=reports.splice(index,1);
   if(body.p_action==='hide'){
    const post=posts.find(item=>item.id===report.post_id);
    if(post)post.visibility='hidden';
   }
   decisions.push(body.p_action);
   return reply(200,null);
  }
  return reply(200,[]);
 });
 await new Promise<void>((resolve,reject)=>{
  fixture.once('error',reject);
  fixture.listen(54321,'127.0.0.1',resolve);
 });
 try{
  const signedIn=await browser.newPage({viewport:{width:360,height:740},isMobile:true,hasTouch:true});
  const admin=await browser.newPage();
  const other=await browser.newPage();
  try{
   await signIn(signedIn,member);
   await signedIn.goto('http://127.0.0.1:3112/community/groups/'+groupId);
   const cards=signedIn.getByRole('article');
   const first=cards.filter({hasText:'Synthetic post to hide'});
   await first.getByRole('button',{name:'Report group post'}).click();
   await expect(first.getByRole('combobox',{name:'Reason'})).toBeFocused();
   await first.getByRole('combobox',{name:'Reason'}).press('Escape');
   await expect(first.getByRole('button',{name:'Report group post'})).toBeFocused();
   for(const title of ['Synthetic post to hide','Synthetic post to keep']){
    const card=cards.filter({hasText:title});
    await card.getByRole('button',{name:'Report group post'}).click();
    await card.getByRole('combobox',{name:'Reason'}).selectOption('spam');
    await card.getByRole('button',{name:'Submit report'}).click();
    if(title==='Synthetic post to hide'){
     const error=card.getByRole('alert');
     await expect(error).toHaveText('The report could not be submitted. Please try again.');
     await expect(error).toBeFocused();
     await expect(card.getByRole('combobox',{name:'Reason'})).toHaveValue('spam');
     expect(reports).toHaveLength(0);
     await card.getByRole('button',{name:'Submit report'}).press('Enter');
    }
    await expect(card.getByText('Report sent to TrustFive moderators.')).toBeFocused();
   }

   await signIn(admin,moderator);
   await admin.goto('http://127.0.0.1:3112/admin');
   const queue=admin.getByRole('region',{name:'Group post reports'});
   await queue.getByRole('button',{name:'Load group reports'}).click();
   await queue.getByRole('article').filter({hasText:'Synthetic post to hide'}).getByRole('button',{name:'Hide post'}).click();
   await expect(queue.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
   await queue.getByRole('button',{name:'Confirm hide post'}).click();
   await expect(queue.getByText('Post hidden and decision recorded.')).toBeFocused();
   await queue.getByRole('article').filter({hasText:'Synthetic post to keep'}).getByRole('button',{name:'Dismiss report'}).click();
   await queue.getByRole('button',{name:'Confirm dismiss report'}).click();
   await expect(queue.getByText('Report dismissed and decision recorded.')).toBeFocused();
   expect(decisions).toEqual(['hide','dismiss']);

   await signedIn.getByRole('button',{name:'Refresh discussions'}).click();
   await expect(cards.filter({hasText:'Synthetic post to keep'})).toBeVisible();
   await expect(first).toHaveCount(0);
   await signIn(other,outsider);
   await other.goto('http://127.0.0.1:3112/community/groups/'+groupId);
   await expect(other.getByText('Join to access its members-only posts.',{exact:false})).toBeVisible();
   await expect(other.getByRole('button',{name:'Report group post'})).toHaveCount(0);
   expect(outsiderPostReads).toBe(0);
  }finally{
   await Promise.all([signedIn.close(),admin.close(),other.close()]);
  }
 }finally{
  await new Promise<void>((resolve,reject)=>fixture.close(error=>error?reject(error):resolve()));
 }
});
