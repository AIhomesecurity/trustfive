import {expect,test} from '@playwright/test';
import {socialNeedsAuthRecheck} from '../../lib/social-auth-identity';

test('Social clears per-account private UI on login/logout and user metadata change',()=>{
 expect(socialNeedsAuthRecheck('SIGNED_IN')).toBe(true);
 expect(socialNeedsAuthRecheck('SIGNED_OUT')).toBe(true);
 expect(socialNeedsAuthRecheck('USER_UPDATED')).toBe(true);
});

test('initial session and token refresh do not produce redundant account invalidation loops',()=>{
 expect(socialNeedsAuthRecheck('INITIAL_SESSION')).toBe(false);
 expect(socialNeedsAuthRecheck('TOKEN_REFRESHED')).toBe(false);
 expect(socialNeedsAuthRecheck('PASSWORD_RECOVERY')).toBe(false);
});
