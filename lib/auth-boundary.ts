/**
 * Routes requiring server-verified authentication. Keep this single rule shared
 * by normal redirects and the missing-configuration fail-closed boundary.
 * Path matching is segment-aware: "/jobs-public" is not "/jobs".
 */
const PROTECTED_ROOTS=new Set([
 'profile','jobs','professional','community','admin','support',
 'dashboard','quotes','bookings','messages','notifications','billing','schedule'
]);

export function isProtectedTrustFiveRoute(pathname:string):boolean{
 if(!pathname.startsWith('/'))return false;
 const first=pathname.split('/')[1];
 return PROTECTED_ROOTS.has(first);
}

export function shouldFailClosedAuthentication(
 pathname:string,hasAuthUrl:boolean,hasPublicKey:boolean
):boolean{
 return isProtectedTrustFiveRoute(pathname)&&(!hasAuthUrl||!hasPublicKey);
}
