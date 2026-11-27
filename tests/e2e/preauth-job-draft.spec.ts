import {expect,test} from '@playwright/test';
import {parsePreAuthJobDraft} from '../../lib/preauth-job-draft';

test.describe('pre-auth customer job draft privacy and validation',()=>{
 test('restores only the brief and rough area from a current local draft',()=>{
  const draft={
   tradeSlug:'cctv-installation',
   title:'Install two cameras',
   description:'Fit two exterior cameras and connect them to the recorder.',
   areaLabel:'LS5',
   expiresAt:Date.now()+60_000,
   phone:'+44 7700 900000',
   exactAddress:'14 High Street, LS5 3AB',
  };

  expect(parsePreAuthJobDraft(JSON.stringify(draft))).toEqual({
   tradeSlug:'cctv-installation',
   title:'Install two cameras',
   description:'Fit two exterior cameras and connect them to the recorder.',
   areaLabel:'LS5',
   expiresAt:draft.expiresAt,
  });
 });

 test('rejects stale, malformed and oversized drafts',()=>{
  expect(parsePreAuthJobDraft(null)).toBeNull();
  expect(parsePreAuthJobDraft('{not-json')).toBeNull();
  expect(parsePreAuthJobDraft(JSON.stringify({
   tradeSlug:'cctv-installation',title:'Install cameras',description:'Install two outdoor cameras at home.',areaLabel:'LS5',expiresAt:Date.now()-1,
  }))).toBeNull();
  expect(parsePreAuthJobDraft('x'.repeat(12_001))).toBeNull();
 });
});
