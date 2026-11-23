import {expect,test} from '@playwright/test';
import {filterLoadedCommunityGroups} from '../../lib/community-group-search';

const areas=[
 {id:'manchester',area_name:'Northern Quarter',city:'Manchester'},
 {id:'leeds',area_name:'City Centre',city:'Leeds'},
];
const groups=[
 {id:'cctv',area_id:'manchester',name:'Home security',description:'CCTV and alarm advice'},
 {id:'garden',area_id:'leeds',name:'Community gardening',description:'Local planting tips'},
 {id:'orphan',area_id:'missing',name:'Neighbour updates',description:'General discussion'},
];

test.describe('bounded community discovery safety',()=>{
 test('combines topic and city terms only within the same group',()=>{
  expect(filterLoadedCommunityGroups(groups,areas,' CCTV   Manchester ').map(g=>g.id)).toEqual(['cctv']);
  expect(filterLoadedCommunityGroups(groups,areas,'CCTV Leeds')).toEqual([]);
 });
 test('does not borrow another area location for an unlinked group',()=>{
  expect(filterLoadedCommunityGroups(groups,areas,'Neighbour Manchester')).toEqual([]);
  expect(filterLoadedCommunityGroups(groups,areas,'Neighbour').map(g=>g.id)).toEqual(['orphan']);
 });
 test('does not mutate the loaded group list when clearing the query',()=>{
  const original=groups.map(g=>g.id);
  const filtered=filterLoadedCommunityGroups(groups,areas,'cctv');
  expect(filtered.map(g=>g.id)).toEqual(['cctv']);
  expect(filterLoadedCommunityGroups(groups,areas,'').map(g=>g.id)).toEqual(original);
  expect(groups.map(g=>g.id)).toEqual(original);
 });
});
