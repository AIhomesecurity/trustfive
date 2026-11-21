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
 if(path.includes('%')||path.split('/').some(segment=>segment==='.'||segment==='..'))
  return '/dashboard';
 const segments=path.split('/').filter(Boolean);
 if(!segments.length||!protectedRoots.has(segments[0]))return '/dashboard';
 // A return hint must not carry another navigation hint: a downstream screen
 // could treat the nested value as a fresh redirect target and escape to
 // another origin. Legitimate journey hints use trade/area/quote/booking.
 const queryIndex=requested.indexOf('?');
 if(queryIndex>=0){
  const nested=new URLSearchParams(requested.slice(queryIndex+1));
  for(const key of ['next','redirect','redirect_to','return_to','returnTo','url','to']){
   if(nested.has(key))return '/dashboard';
  }
 }
 if(requested.length>2048)return '/dashboard';
 return requested;
}
