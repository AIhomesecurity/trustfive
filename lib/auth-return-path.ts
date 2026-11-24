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
    /[\\\\#\u0000-\u001f\u007f]/.test(requested))return '/dashboard';
 const path=requested.split('?',1)[0];
 if(path.includes('%')||path.split('/').some(segment=>segment==='.'||segment==='..'))
  return '/dashboard';
 const segments=path.split('/').filter(Boolean);
 const uuid='[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
 const showcase=new RegExp('^/business/'+uuid+'/work/'+uuid+'$','i');
 if(!segments.length||(!protectedRoots.has(segments[0])&&!showcase.test(path)))return '/dashboard';
 if(requested.length>2048)return '/dashboard';
 return requested;
}
