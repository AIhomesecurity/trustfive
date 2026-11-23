import {expect,test} from '@playwright/test';
import {SOCIAL_SECTIONS,socialSectionFromQuery,socialSectionHref} from '../../lib/social-sections';
import {safeAuthReturnPath} from '../../lib/auth-return-path';

test('each Social section has a stable URL that survives the auth allowlist',()=>{
 for(const section of SOCIAL_SECTIONS){
  const href=socialSectionHref(section.id);
  const url=new URL(href,'https://trustfive.test');
  expect(socialSectionFromQuery(url.searchParams.getAll('tab'))).toBe(section.id);
  expect(safeAuthReturnPath(href)).toBe(href);
 }
});

test('missing, unknown and ambiguous section values use the neighbourhood',()=>{
 for(const values of [[],['oops'],['trade','events'],['saved','saved'],['https://example.test']]){
  expect(socialSectionFromQuery(values)).toBe('neighbourhood');
 }
});
