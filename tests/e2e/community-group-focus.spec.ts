import {expect,test} from '@playwright/test';
import {restoreGroupListFocus} from '../../lib/community-group-focus';

test('closing group posts restores keyboard focus to a still-connected opener',()=>{
 let openerFocused=0,searchFocused=0;
 const result=restoreGroupListFocus(
  {isConnected:true,disabled:false,focus:()=>{openerFocused++;}},
  {focus:()=>{searchFocused++;}}
 );
 expect(result).toBe('opener');
 expect(openerFocused).toBe(1);
 expect(searchFocused).toBe(0);
});

test('closing after filtering out opener focuses the visible group search',()=>{
 for(const opener of [
  {isConnected:false,disabled:false,focus:()=>{throw Error('Detached opener focused');}},
  {isConnected:true,disabled:true,focus:()=>{throw Error('Disabled opener focused');}}
 ]){
  let searchFocused=0;
  expect(restoreGroupListFocus(opener,{focus:()=>{searchFocused++;}})).toBe('search');
  expect(searchFocused).toBe(1);
 }
});

test('focus restoration tolerates missing controls without throwing',()=>{
 expect(restoreGroupListFocus(null,null)).toBe('none');
});
