import {test,expect} from '@playwright/test';
import {meaningfulJobTextLength} from '../../lib/job-text';

test('Customer job title cannot pass with internal whitespace padding',()=>{
 expect(meaningfulJobTextLength(' a    b    ')).toBe(2);
 expect(meaningfulJobTextLength('Fix tap')).toBe(6);
 expect(meaningfulJobTextLength('   \t \n  ')).toBe(0);
});

test('Customer work descriptions count actual characters, including Unicode',()=>{
 expect(meaningfulJobTextLength('Leak'+ ' '.repeat(100)+'tap')).toBe(7);
 expect(meaningfulJobTextLength('Repair kitchen tap')).toBe(16);
 expect(meaningfulJobTextLength('修理 水管')).toBe(4);
 expect(meaningfulJobTextLength('A\u00a0\u2003B')).toBe(2);
});
