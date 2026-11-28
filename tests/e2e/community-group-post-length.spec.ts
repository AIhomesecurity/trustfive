import {expect,test} from '@playwright/test';
import {canPublishCommunityGroupPost} from '../../lib/community-group-publishing';

const allowed = (body:string) => canPublishCommunityGroupPost({
 signedIn:true,selectedGroupId:'group-1',memberGroupIds:['group-1'],
 body,busy:false,postsLoading:false,postsError:false,
});

test('group post minimum length excludes leading and trailing whitespace',()=>{
 expect(allowed('       abc       ')).toBe(false);
 expect(allowed('   abcdefgh   ')).toBe(true);
 expect(allowed('abcdefgh')).toBe(true);
});

test('group post maximum length is enforced after trimming',()=>{
 expect(allowed('a'.repeat(3000))).toBe(true);
 expect(allowed('a'.repeat(3001))).toBe(false);
});

test('group posts cannot publish without membership or while posts fail to load',()=>{
 expect(canPublishCommunityGroupPost({
  signedIn:true,selectedGroupId:'group-1',memberGroupIds:[],
  body:'A useful update',busy:false,postsLoading:false,postsError:false,
 })).toBe(false);
 expect(canPublishCommunityGroupPost({
  signedIn:true,selectedGroupId:'group-1',memberGroupIds:['group-1'],
  body:'A useful update',busy:false,postsLoading:false,postsError:true,
 })).toBe(false);
});
