import {expect,test} from '@playwright/test';
import {SOCIAL_PAGE_SIZE,socialPageBounds,socialPageRows,socialSearchPattern} from '../../lib/social-feed-paging';

test('literal post searches escape wildcard characters and trim length',()=>{
 expect(socialSearchPattern('  CCTV  ')).toBe('%CCTV%');
 expect(socialSearchPattern('100% CCTV_camera\\test')).toBe('%100\\% CCTV\\_camera\\\\test%');
 expect(socialSearchPattern('x'.repeat(300)).length).toBe(122);
});

test('server page ranges request one look-ahead row without unbounded scans',()=>{
 expect(SOCIAL_PAGE_SIZE).toBe(20);
 expect(socialPageBounds(0)).toEqual({from:0,to:20});
 expect(socialPageBounds(1)).toEqual({from:20,to:40});
 expect(socialPageBounds(-5)).toEqual({from:0,to:20});
 expect(socialPageBounds(Number.NaN)).toEqual({from:0,to:20});
 expect(socialPageBounds(999999)).toEqual({from:10000,to:10020});
});

test('visible page excludes look-ahead sentinel and reports more only when present',()=>{
 expect(socialPageRows(Array.from({length:20},(_,i)=>i))).toEqual({items:Array.from({length:20},(_,i)=>i),hasMore:false});
 expect(socialPageRows(Array.from({length:21},(_,i)=>i))).toEqual({items:Array.from({length:20},(_,i)=>i),hasMore:true});
});
