import {expect,test} from '@playwright/test';
import {communityGroupLocationLabel} from '../lib/community-group-location';

test.describe('community group location labels',()=>{
 test('shows neighbourhood and city without claiming territory verification',()=>{
  const areas=[{id:'area-1',area_name:'Northern Quarter',city:'Manchester'}];
  expect(communityGroupLocationLabel('area-1',areas)).toBe('Northern Quarter, Manchester');
  expect(areas[0].area_name).toBe('Northern Quarter');
 });
 test('does not guess a location when the linked area is missing',()=>{
  expect(communityGroupLocationLabel('missing',[{id:'other',area_name:'Central',city:'Leeds'}])).toBe('Area unavailable');
 });
 test('handles blank names and whitespace without exposing undefined values',()=>{
  expect(communityGroupLocationLabel('a',[{id:'a',area_name:'   ',city:'  '}])).toBe('Area unavailable');
  expect(communityGroupLocationLabel('a',[{id:'a',area_name:'  Riverside  ',city:'  Bristol  '}])).toBe('Riverside, Bristol');
 });
 test('allows a known neighbourhood when its city is unavailable',()=>{
  expect(communityGroupLocationLabel('a',[{id:'a',area_name:'Riverside',city:null}])).toBe('Riverside');
 });
});
