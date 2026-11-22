import {expect,test} from '@playwright/test';
import {SOCIAL_ASSISTANCE_TYPES,isSocialAssistanceType,socialTradeRequestError} from '../../lib/social-trade-collaboration';

const valid={
 userId:'pro-user',tradeId:'electrician-trade',tradeIds:['electrician-trade'],
 areaId:'area-1',areaIds:['area-1'],assistanceType:'specialist_support',earliestWeek:'2026-12-01'
};
test('collaboration form accepts only structured non-customer data',()=>{
 expect(SOCIAL_ASSISTANCE_TYPES.map(([id])=>id)).toContain('specialist_support');
 expect(isSocialAssistanceType('installation')).toBe(true);
 expect(isSocialAssistanceType('customer_job_lead')).toBe(false);
 expect(socialTradeRequestError(valid)).toBeNull();
 expect(socialTradeRequestError({...valid,earliestWeek:''})).toBeNull();
});
test('collaboration form rejects unknown areas, trades, types and unauthenticated posts',()=>{
 expect(socialTradeRequestError({...valid,userId:''})).toMatch(/Sign in/);
 expect(socialTradeRequestError({...valid,tradeId:'not-a-trade'})).toMatch(/available trade/);
 expect(socialTradeRequestError({...valid,areaId:'made-up'})).toMatch(/general service area/);
 expect(socialTradeRequestError({...valid,assistanceType:'private_customer_job'})).toMatch(/recognised/);
 expect(socialTradeRequestError({...valid,earliestWeek:'random'})).toMatch(/valid date/);
});
