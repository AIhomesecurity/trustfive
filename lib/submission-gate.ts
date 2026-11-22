/** Prevent overlapping customer mutations before React has rendered busy=true.
 * This is a client-side UX safeguard, not a substitute for database idempotency. */
export function createSubmissionGate(){
 let inFlight=false;
 return {
  acquire():boolean {
   if(inFlight)return false;
   inFlight=true;
   return true;
  },
  release():void {inFlight=false;},
  isBusy():boolean {return inFlight;}
 };
}
