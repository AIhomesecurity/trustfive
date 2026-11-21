import {expect,test} from '@playwright/test';
import {normaliseTerm,resolveTradeQuery,type TradeChoice} from '../../lib/trade-search';

// Pure resolver checks. Categories are real database slugs, not provider records.
const trades:TradeChoice[]=[
 {id:'11111111-1111-1111-1111-111111111111',name:'Plumbing',slug:'plumbing'},
 {id:'22222222-2222-2222-2222-222222222222',name:'Electrical',slug:'electrical'},
 {id:'33333333-3333-3333-3333-333333333333',name:'CCTV and cameras',slug:'cctv-installation'},
 {id:'44444444-4444-4444-4444-444444444444',name:'Home security',slug:'home-security'},
 {id:'55555555-5555-5555-5555-555555555555',name:'Roofing',slug:'roofing'},
 {id:'66666666-6666-6666-6666-666666666666',name:'Cleaning',slug:'cleaning'}
];
const slugFor=(query:string)=>resolveTradeQuery(query,trades).best?.trade.slug;

test('Search terms are normalised without trusting markup or case',()=>{
 expect(normaliseTerm('  CCTV  Installation! ')).toBe('cctv installation');
 expect(normaliseTerm('<img src=x onerror=alert(1)>')).toBe('img src x onerror alert 1');
});

test('Common customer terms and alternative wording resolve to real categories',()=>{
 expect(slugFor('plumber')).toBe('plumbing');
 expect(slugFor('Plumbers')).toBe('plumbing');
 expect(slugFor('burst pipe')).toBe('plumbing');
 expect(slugFor('leaking tap')).toBe('plumbing');
 expect(slugFor('electrician')).toBe('electrical');
 expect(slugFor('electricians')).toBe('electrical');
 expect(slugFor('rewiring')).toBe('electrical');
 expect(slugFor('roofer')).toBe('roofing');
 expect(slugFor('guttering')).toBe('roofing');
 expect(slugFor('deep clean')).toBe('cleaning');
});

test('Security search terms resolve to the correct separate trade categories',()=>{
 expect(slugFor('CCTV')).toBe('cctv-installation');
 expect(slugFor('CCTV installation')).toBe('cctv-installation');
 expect(slugFor('security camera')).toBe('cctv-installation');
 expect(slugFor('security cameras')).toBe('cctv-installation');
 expect(slugFor('video doorbell')).toBe('cctv-installation');
 expect(slugFor('alarms')).toBe('home-security');
 expect(slugFor('burglar alarm')).toBe('home-security');
});

test('Small spelling mistakes suggest a category but never invent one',()=>{
 expect(slugFor('eletrician')).toBe('electrical');
 expect(slugFor('plummer')).toBe('plumbing');
 const result=resolveTradeQuery('eletrician',trades);
 expect(result.matches.every(match=>trades.some(trade=>trade.id===match.trade.id))).toBe(true);
 expect(result.matches.some(match=>match.reason==='typo')).toBe(true);
});

test('Untrusted fragments do not become a category and no match stays honest',()=>{
 expect(slugFor('<img src=x onerror=alert(1)>')).toBeUndefined();
 expect(slugFor('img')).toBeUndefined();
 expect(slugFor('i')).toBeUndefined();
 expect(slugFor('and')).toBeUndefined();
 expect(resolveTradeQuery('',trades)).toMatchObject({reason:'empty',matches:[]});
 expect(resolveTradeQuery(' cctv ',trades.slice(0,1)).best).toBeUndefined();
});
