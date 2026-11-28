import {test,expect} from '@playwright/test';
import {filterLoadedCommunityGroups} from '../../lib/community-group-search';

const groups=[
 {id:'a',name:'Community Gardeners',description:'Share compost and planting advice',area_id:'north'},
 {id:'b',name:'Neighbourhood Watch',description:'CCTV and alarm discussions',area_id:'south'},
 {id:'c',name:'Weekend Walkers',description:'Meet for local walks',area_id:'north'}
];
const areas=[{id:'north',area_name:'North Quarter',city:'Manchester'},{id:'south',area_name:'South Quarter',city:'Birmingham'}];

test('searches the loaded authorised group list by name, description and neighbourhood',()=>{
 expect(filterLoadedCommunityGroups(groups,areas,'garden').map(g=>g.id)).toEqual(['a']);
 expect(filterLoadedCommunityGroups(groups,areas,'CCTV').map(g=>g.id)).toEqual(['b']);
 expect(filterLoadedCommunityGroups(groups,areas,'north quarter').map(g=>g.id)).toEqual(['a','c']);
 expect(filterLoadedCommunityGroups(groups,areas,'Manchester').map(g=>g.id)).toEqual(['a','c']);
 expect(filterLoadedCommunityGroups(groups,areas,'birmingham').map(g=>g.id)).toEqual(['b']);
 expect(filterLoadedCommunityGroups(groups,areas,'  ALARM  ').map(g=>g.id)).toEqual(['b']);
});
test('preserves source order and never invents or mutates groups',()=>{
 expect(filterLoadedCommunityGroups(groups,areas,'')).toEqual(groups);
 expect(filterLoadedCommunityGroups(groups,areas,'missing')).toEqual([]);
 expect(groups).toHaveLength(3);
});

test('search tolerates area records without a city and does not match unrelated cities',()=>{
 expect(filterLoadedCommunityGroups(groups,[{id:'north',area_name:'North Quarter'}],'manchester')).toEqual([]);
 expect(filterLoadedCommunityGroups(groups,[{id:'north',area_name:'North Quarter'}],'north').map(g=>g.id)).toEqual(['a','c']);
});

test('matches accents and repeated mobile keyboard whitespace without changing source data',()=>{
 const accented=[...groups,{id:'d',name:'Café neighbours',description:'  Local   safety discussions',area_id:'north'}];
 expect(filterLoadedCommunityGroups(accented,areas,'cafe').map(g=>g.id)).toEqual(['d']);
 expect(filterLoadedCommunityGroups(accented,areas,'local safety').map(g=>g.id)).toEqual(['d']);
 expect(filterLoadedCommunityGroups(accented,areas,'  north   quarter  ').map(g=>g.id)).toEqual(['a','c','d']);
 expect(filterLoadedCommunityGroups(accented,areas,'café').map(g=>g.id)).toEqual(['d']);
 expect(accented[3].name).toBe('Café neighbours');
});
