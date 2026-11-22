import {expect,test} from '@playwright/test';
import {socialPostReplyCount,socialReactionIsActive,socialReplyError} from '../../lib/social-discussion';

test('replies reject insufficient content and overlong text',()=>{
 expect(socialReplyError('')).toMatch(/two characters/);
 expect(socialReplyError('  x  ')).toMatch(/two characters/);
 expect(socialReplyError(' ok ')).toBeNull();
 expect(socialReplyError('x'.repeat(1500))).toBeNull();
 expect(socialReplyError('x'.repeat(1501))).toMatch(/1,500/);
});

test('reaction state uses only genuine returned values',()=>{
 expect(socialReactionIsActive(null,'like')).toBe(false);
 expect(socialReactionIsActive('like','like')).toBe(true);
 expect(socialReactionIsActive('support','like')).toBe(false);
 expect(socialReactionIsActive('support','support')).toBe(true);
 expect(socialReactionIsActive('other','support')).toBe(false);
});

test('discussion counts respect the post boundary',()=>{
 const rows=[
  {id:'1',post_id:'a',body:'Thanks',created_at:'2026-11-22T10:00:00Z'},
  {id:'2',post_id:'b',body:'Other discussion',created_at:'2026-11-22T11:00:00Z'},
  {id:'3',post_id:'a',body:'Follow-up',created_at:'2026-11-22T11:15:00Z'}
 ];
 expect(socialPostReplyCount(rows,'a')).toBe(2);
 expect(socialPostReplyCount(rows,'b')).toBe(1);
 expect(socialPostReplyCount(rows,'c')).toBe(0);
});
