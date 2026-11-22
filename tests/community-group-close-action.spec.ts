import {expect,test} from '@playwright/test';
import {communityGroupActionLabel} from '../lib/community-group-actions';

test.describe('accessible group action names',()=>{
 test('distinguishes join, open and close for a named group',()=>{
  expect(communityGroupActionLabel('join','CCTV neighbours')).toBe('Join CCTV neighbours');
  expect(communityGroupActionLabel('open','CCTV neighbours')).toBe('Open posts for CCTV neighbours');
  expect(communityGroupActionLabel('close','CCTV neighbours')).toBe('Close posts for CCTV neighbours');
 });
 test('does not announce blank group names',()=>{
  expect(communityGroupActionLabel('close','   ')).toBe('Close posts for unnamed group');
 });
});
