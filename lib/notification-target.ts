/** Notification routes are untrusted data until validated. A link grants no
 * record access; account-scoped RLS and page guards remain authoritative. */
const simpleRoutes=new Set(['/jobs','/bookings','/messages','/professional/apply']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept only canonical route and parameter spellings. Case-insensitive
 * matching here would silently produce noncanonical or broken deep links. */
export function safeNotificationTarget(path:string):string|null{
 if(simpleRoutes.has(path))return path;
 if(path.length>100||!path.startsWith('/')||path.includes('#')||path.includes('\\'))return null;
 const query=path.match(/^\/(messages|bookings|schedule)\?(quote|booking)=([0-9a-fA-F-]+)$/);
 if(!query)return null;
 const [,page,key,id]=query;
 if((page==='messages'&&key!=='quote')||((page==='bookings'||page==='schedule')&&key!=='booking')||!uuid.test(id))return null;
 return '/'+page+'?'+key+'='+id.toLowerCase();
}
