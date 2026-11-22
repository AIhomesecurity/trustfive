import {expect,test} from '@playwright/test';
import {SOCIAL_ADVICE_TOPICS,isSocialAdviceTopic,socialQuestionBody,socialQuestionSearchPattern} from '../../lib/social-advice';

test('question topics include the critical CCTV category and accept only enumerated topics',()=>{
 expect(SOCIAL_ADVICE_TOPICS).toContain('CCTV & security');
 expect(SOCIAL_ADVICE_TOPICS).toContain('Electrical');
 expect(isSocialAdviceTopic('Plumbing')).toBe(true);
 expect(isSocialAdviceTopic('verified electrician')).toBe(false);
 expect(isSocialAdviceTopic('')).toBe(false);
});

test('question composer produces identifiable published-text headings without fabricated credentials',()=>{
 expect(socialQuestionBody('CCTV & security','Best way to position a CCTV camera?'))
  .toBe('Question about CCTV & security: Best way to position a CCTV camera?');
 expect(socialQuestionBody('unknown','Can you help please?')).toBeNull();
 expect(socialQuestionBody('Roofing','  short ')).toBeNull();
 expect(socialQuestionBody('Roofing','a'.repeat(3000))).toBeNull();
});

test('topic discovery uses a bounded, exact literal prefix and rejects unknown queries',()=>{
 expect(socialQuestionSearchPattern('all')).toBe('Question about %:%');
 expect(socialQuestionSearchPattern('Electrical')).toBe('Question about Electrical:%');
 expect(socialQuestionSearchPattern('cctv installer from outside list')).toBeNull();
});
