import {expect,test} from '@playwright/test';
import {socialPostValidationError} from '../../lib/social-post-composer';

const valid={authorId:'user-123',areaId:'area-1',availableAreaIds:['area-1','area-2'],body:'Advice about CCTV cameras for the garden.'};

test('social composer does not allow anonymous posting or a fabricated neighbourhood',()=>{
 expect(socialPostValidationError({...valid,authorId:''})).toMatch(/Sign in/);
 expect(socialPostValidationError({...valid,areaId:'area-unverified'})).toMatch(/available neighbourhood/);
 expect(socialPostValidationError({...valid,areaId:''})).toMatch(/available neighbourhood/);
});

test('social composer enforces meaningful content limits without modifying written content',()=>{
 expect(socialPostValidationError({...valid,body:'  hi   '})).toMatch(/8 characters/);
 expect(socialPostValidationError({...valid,body:'a'.repeat(3001)})).toMatch(/3,000/);
 expect(socialPostValidationError({...valid,body:'   Genuine local question  '})).toBeNull();
 expect(socialPostValidationError(valid)).toBeNull();
});
