/** A synchronous per-page guard for professional quote and completion mutations.
 * React state updates are asynchronous; checking a busy boolean alone cannot
 * prevent two same-tick clicks from issuing duplicate database writes.
 * The server remains authoritative for permissions and uniqueness.
 */
export function createProfessionalMutationGate(){
 let active=false;
 return {
  isBusy:()=>active,
  async run<T>(action:()=>Promise<T>):Promise<{started:false}|{started:true;value:T}>{
   if(active)return {started:false};
   active=true;
   try{return {started:true,value:await action()};}
   finally{active=false;}
  }
 };
}
