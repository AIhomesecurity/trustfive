import {expect,test} from '@playwright/test';
import {communityGroupActionDisabled,communityGroupActionLabel} from '../../lib/community-group-actions';

test('repeated group action buttons announce the specific group',()=>{
 expect(communityGroupActionLabel('join','  CCTV and alarms  ')).toBe('Join CCTV and alarms');
 expect(communityGroupActionLabel('open','Community gardeners')).toBe('Open posts for Community gardeners');
 expect(communityGroupActionLabel('join','  ')).toBe('Join unnamed group');
});

test('group actions are disabled during writes or initial loading',()=>{
 expect(communityGroupActionDisabled(false,false)).toBe(false);
 expect(communityGroupActionDisabled(true,false)).toBe(true);
 expect(communityGroupActionDisabled(false,true)).toBe(true);
 expect(communityGroupActionDisabled(true,true)).toBe(true);
});
