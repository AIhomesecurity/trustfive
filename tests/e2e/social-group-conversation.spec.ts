import {expect,test} from '@playwright/test';
import {
 socialGroupRouteId,socialGroupPostError,socialGroupCanPublish,socialGroupCanLeave,
 socialGroupPostPage,socialGroupVisiblePage,socialGroupFocusTarget,type GroupConversationMembership
} from '../../lib/social-group-conversation';

const member:GroupConversationMembership={
 group_id:'group-a',user_id:'member-1',role:'member'
};
const owner:GroupConversationMembership={
 group_id:'group-a',user_id:'owner-1',role:'owner'
};

test('group links require complete canonical UUID and reject path traversal or arbitrary IDs',()=>{
 expect(socialGroupRouteId('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'))
  .toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
 for(const invalid of ['', 'group-a', '../admin', 'a%2Fb', 'not-a-uuid', 'a'.repeat(100)]){
  expect(socialGroupRouteId(invalid),invalid).toBeNull();
 }
 expect(socialGroupRouteId(['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'])).toBeNull();
 expect(socialGroupRouteId(undefined)).toBeNull();
});

test('only a genuine signed-in member of the selected group may publish',()=>{
 expect(socialGroupCanPublish('member-1','group-a',member,'A useful community update')).toBe(true);
 expect(socialGroupCanPublish('owner-1','group-a',owner,'A useful owner update')).toBe(true);
 expect(socialGroupCanPublish('', 'group-a',member,'A useful community update')).toBe(false);
 expect(socialGroupCanPublish('member-2','group-a',member,'A useful community update')).toBe(false);
 expect(socialGroupCanPublish('member-1','group-b',member,'A useful community update')).toBe(false);
 expect(socialGroupCanPublish('member-1','group-a',null,'A useful community update')).toBe(false);
 expect(socialGroupCanPublish('member-1','group-a',member,'short')).toBe(false);
});

test('post validation enforces database text limits after whitespace trimming',()=>{
 expect(socialGroupPostError('   ')).toMatch(/8 characters/);
 expect(socialGroupPostError('a'.repeat(7))).toMatch(/8 characters/);
 expect(socialGroupPostError('a'.repeat(8))).toBeNull();
 expect(socialGroupPostError('a'.repeat(3000))).toBeNull();
 expect(socialGroupPostError('a'.repeat(3001))).toMatch(/3,000/);
});

test('founders cannot leave via member-only controls, and other accounts cannot impersonate',()=>{
 expect(socialGroupCanLeave('member-1',member)).toBe(true);
 expect(socialGroupCanLeave('owner-1',owner)).toBe(false);
 expect(socialGroupCanLeave('member-2',member)).toBe(false);
 expect(socialGroupCanLeave('',member)).toBe(false);
 expect(socialGroupCanLeave('member-1',null)).toBe(false);
});

test('group conversation pages are bounded with one lookahead record',()=>{
 expect(socialGroupPostPage(0)).toEqual({from:0,to:20});
 expect(socialGroupPostPage(2)).toEqual({from:40,to:60});
 expect(socialGroupPostPage(-1)).toEqual({from:0,to:20});
 expect(socialGroupPostPage(Infinity)).toEqual({from:0,to:20});
 expect(socialGroupPostPage(99999)).toEqual({from:2000,to:2020});
 const visible=socialGroupVisiblePage(Array.from({length:21},(_,id)=>id));
 expect(visible.posts).toHaveLength(20);
 expect(visible.hasMore).toBe(true);
 expect(socialGroupVisiblePage([1,2]).hasMore).toBe(false);
});

test.describe('real group discussions anonymous security boundary',()=>{
 test.use({storageState:{cookies:[],origins:[]}});
 test('signed-out users cannot reach member group content',async({page})=>{
  await page.goto('/community/groups/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  await expect(page).toHaveURL(/\/account\?next=%2Fcommunity%2Fgroups%2F/);
  await expect(page.getByRole('heading',{name:'Member discussions'})).toHaveCount(0);
 });
 test('mobile deep links cannot expose private discussion content',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('/community/groups/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  await expect(page).toHaveURL(/\/account\?next=%2Fcommunity%2Fgroups%2F/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
 });
});

test('membership controls restore focus after their buttons unmount',()=>{
 expect(socialGroupFocusTarget('joined')).toBe('composer');
 expect(socialGroupFocusTarget('left')).toBe('join');
});
