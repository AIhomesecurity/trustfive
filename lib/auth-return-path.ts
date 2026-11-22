/** Restrict post-auth navigation to TrustFive's own authenticated routes.
 * A requested return path is a navigation hint, never proof of access. */
const protectedRoots=new Set([
 'profile','jobs','professional','community','admin','support','dashboard',
 'quotes','bookings','messages','notifications','billing','schedule','coverage'
]);

export function safeAuthReturnPath(requested:string|null,allowPasswordReset=false):string{
 if(!requested)return '/dashboard';
 if(allowPasswordReset&&requested==='/auth/update-password')return requested;
 // Relative internal paths only. Do not let URL normalisation turn an unsafe
 // user value into a redirect to another origin or an unexpected route.
 if(!requested.startsWith('/')||requested.startsWith('//')||
    /[\\#\u0000-\u001f\u007f]/.test(requested))return '/dashboard';
 const path=requested.split('?',1)[0];
 // Browsers and proxies may collapse repeated slashes, dot/space suffixes or
 // Unicode direction controls differently. Reject ambiguous paths rather than
 // redirecting to a route different from the one that was authorised.
 if(path.includes('%')||path.includes('//')||
    /[\u202a-\u202e\u2066-\u2069]/u.test(requested)||
    path.split('/').some(segment=>segment==='.'||segment==='..'||/[. ]$/.test(segment)))
  return '/dashboard';
 const segments=path.split('/').filter(Boolean);
 if(!segments.length||!protectedRoots.has(segments[0]))return '/dashboard';
 if(requested.length>2048)return '/dashboard';
 return requested;
}
