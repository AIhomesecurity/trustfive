import {expect,test} from '@playwright/test';
import {communityGroupDraftError,communityGroupMeaningfulLength} from '../../lib/community-group-draft';

test('rejects whitespace-only and padded short group names',()=>{
 expect(communityGroupDraftError('     ','A useful community group for neighbours')).toMatch(/group name/);
 expect(communityGroupDraftError('  CCTV  ','A useful community group for neighbours')).toBeNull();
 expect(communityGroupDraftError(' a  ','A useful community group for neighbours')).toMatch(/group name/);
});

test('rejects whitespace-only and padded short descriptions',()=>{
 expect(communityGroupDraftError('CCTV group','                    ')).toMatch(/Describe/);
 expect(communityGroupDraftError('CCTV group','  too short   ')).toMatch(/Describe/);
 expect(communityGroupDraftError('CCTV group','  Sharing CCTV advice with neighbours.  ')).toBeNull();
});

test('validation leaves user input unchanged',()=>{
 const name='  CCTV neighbours  ',description='  Sharing CCTV advice with neighbours.  ';
 expect(communityGroupDraftError(name,description)).toBeNull();
 expect(name).toBe('  CCTV neighbours  ');
 expect(description).toBe('  Sharing CCTV advice with neighbours.  ');
});


test('rejects internal whitespace padding and line breaks used to bypass minimums',()=>{
 expect(communityGroupDraftError('a  b','Sharing practical CCTV advice with neighbours')).toMatch(/group name/);
 expect(communityGroupDraftError('CCTV neighbours','a   b   c   d   e   f   g')).toMatch(/Describe/);
 expect(communityGroupDraftError('CCTV neighbours','a\n\t b\n\t c\n\t d')).toMatch(/Describe/);
});

test('accepts minimum meaningful characters despite spacing',()=>{
 expect(communityGroupDraftError('C C T V','One two three four five six')).toBeNull();
});


test('meaningful character guidance matches validation for whitespace-padded drafts',()=>{
 expect(communityGroupMeaningfulLength(' a  b  c ')).toBe(3);
 expect(communityGroupDraftError(' a  b  c ','A sufficiently descriptive group topic')).toMatch(/group name/);
 expect(communityGroupMeaningfulLength(' C C T V ')).toBe(4);
 expect(communityGroupDraftError(' C C T V ','A sufficiently descriptive group topic')).toBeNull();
 expect(communityGroupMeaningfulLength('a\n\t b')).toBe(2);
 expect(communityGroupMeaningfulLength('a\u200Bb\u200Cc')).toBe(3);
 expect(communityGroupDraftError('a\u200Bb\u200Cc','A sufficiently descriptive group topic')).toMatch(/group name/);
 expect(communityGroupMeaningfulLength('CCTV\u200B')).toBe(4);
});
