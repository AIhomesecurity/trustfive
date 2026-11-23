import {expect,test} from '@playwright/test';
import {communityGroupActionLabel} from '../../lib/community-group-actions';

test.describe('accessible group action names',()=>{
 test('distinguishes join, open and close for a named group',()=>{
  expect(communityGroupActionLabel('join','CCTV neighbours')).toBe('Join CCTV neighbours');
  expect(communityGroupActionLabel('open','CCTV neighbours')).toBe('Open posts for CCTV neighbours');
  expect(communityGroupActionLabel('close','CCTV neighbours')).toBe('Close posts for CCTV neighbours');
 });
 test('names repeated group page links and keeps the visible label in the accessible name',()=>{
  expect(communityGroupActionLabel('view',' CCTV neighbours ')).toBe('View group page for CCTV neighbours');
  expect(communityGroupActionLabel('view','Garden group')).toBe('View group page for Garden group');
  expect(communityGroupActionLabel('view','   ')).toBe('View group page for unnamed group');
 });
 test('does not announce blank group names',()=>{
  expect(communityGroupActionLabel('close','   ')).toBe('Close posts for unnamed group');
 });
});
