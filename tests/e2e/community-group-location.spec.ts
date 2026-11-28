import {expect,test} from '@playwright/test';
import {communityGroupLocationLabel} from '../../lib/community-group-location';

const areas=[
 {id:'one',area_name:'  Northern Quarter  ',city:'  Manchester '},
 {id:'two',area_name:'Old Town',city:''},
 {id:'three',area_name:'  ',city:'  '}
];

test('group location includes neighbourhood and city without extra whitespace',()=>{
 expect(communityGroupLocationLabel('one',areas)).toBe('Northern Quarter, Manchester');
 expect(communityGroupLocationLabel('two',areas)).toBe('Old Town');
});

test('unknown or blank areas do not imply local coverage',()=>{
 expect(communityGroupLocationLabel('missing',areas)).toBe('Area unavailable');
 expect(communityGroupLocationLabel('three',areas)).toBe('Area unavailable');
 expect(communityGroupLocationLabel('',[])).toBe('Area unavailable');
});

test('display helper never mutates source area data',()=>{
 const before=JSON.stringify(areas);
 communityGroupLocationLabel('one',areas);
 expect(JSON.stringify(areas)).toBe(before);
});
