import {expect,test} from '@playwright/test';
import {communityGroupDraftError} from '../../lib/community-group-draft';

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
