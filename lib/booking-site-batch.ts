/**
 * Load private booking-site information without making an unavailable address
 * block the booking history. Keep requests bounded to avoid overwhelming RPC.
 * The caller must still rely on authenticated, authorisation-checked database
 * functions; this helper grants no address access.
 */
export async function loadBookingSiteBatch<T>(
 bookingIds: readonly string[],
 fetchSite: (bookingId: string) => Promise<T | null>,
 batchSize = 6
): Promise<{sites: Record<string, T | null>; unavailableIds: string[]}> {
 if(!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20)
  throw new Error('Invalid booking-site batch size');
 // A null-prototype dictionary ensures opaque record IDs can never resolve
 // inherited properties (notably __proto__/constructor) or mutate prototypes.
 const sites: Record<string,T|null> = Object.create(null);
 const unavailableIds: string[] = [];
 // Repeated IDs must not produce competing requests or inconsistent privacy
 // results when the customer's booking list contains duplicate records.
 const uniqueIds = [...new Set(bookingIds)];
 for(let i=0;i<uniqueIds.length;i+=batchSize){
  const current=uniqueIds.slice(i,i+batchSize);
  const settled=await Promise.allSettled(current.map(id=>fetchSite(id)));
  settled.forEach((result,index)=>{
   const id=current[index];
   if(result.status==='fulfilled')sites[id]=result.value;
   else{sites[id]=null;unavailableIds.push(id);}
  });
 }
 return {sites,unavailableIds};
}
