import {expect,test} from '@playwright/test';
import {canPublishCommunityGroupPost} from '../../lib/community-group-publishing';

const ready={
 signedIn:true,
 selectedGroupId:'group-a',
 memberGroupIds:['group-a'],
 body:'Can anyone recommend a CCTV installer?',
 busy:false,
 postsLoading:false,
 postsError:false
};

test('group publishing requires an authenticated member of the selected group',()=>{
 expect(canPublishCommunityGroupPost(ready)).toBe(true);
 expect(canPublishCommunityGroupPost({...ready,signedIn:false})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,selectedGroupId:'group-b'})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,selectedGroupId:''})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,memberGroupIds:[]})).toBe(false);
});

test('group publishing refuses duplicate or uncertain submissions and invalid text',()=>{
 expect(canPublishCommunityGroupPost({...ready,busy:true})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,postsLoading:true})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,postsError:true})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,body:'   hello   '})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,body:'a'.repeat(3001)})).toBe(false);
 expect(canPublishCommunityGroupPost({...ready,body:'  valid community post  '})).toBe(true);
});
