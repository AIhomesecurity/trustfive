import {expect,test} from '@playwright/test';
import {socialVisibleSavedPosts,type SocialSavedRecord} from '../../lib/social-saved-posts';
import type {SocialPostSummary} from '../../lib/social-discovery';

const post=(id:string,visibility='published'):SocialPostSummary=>({
 id,area_id:'area',body:'A real community discussion',created_at:'2026-11-22T10:00:00Z',visibility
});
test('private saved list keeps bookmark order and never displays unavailable or hidden posts',()=>{
 const records:SocialSavedRecord[]=[
  {post_id:'b',saved_at:'2026-11-22T10:02:00Z'},
  {post_id:'hidden',saved_at:'2026-11-22T10:01:00Z'},
  {post_id:'a',saved_at:'2026-11-22T10:00:00Z'},
  {post_id:'deleted',saved_at:'2026-11-22T09:00:00Z'},
  {post_id:'b',saved_at:'2026-11-22T08:00:00Z'}
 ];
 expect(socialVisibleSavedPosts(records,[post('a'),post('b'),post('hidden','hidden')])
  .map(item=>item.id)).toEqual(['b','a']);
 expect(socialVisibleSavedPosts(records,[])).toEqual([]);
});
