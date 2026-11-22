/** Synchronous single-flight gate for private notification mutations.
 * React's render state is asynchronous and must not be the request lock.
 * A failed request releases the gate so the account holder can retry.
 */
export function createNotificationReadGate() {
 let active = false;
 return {
  async run<T>(operation: () => Promise<T>): Promise<{started:boolean;value?:T}> {
   if (active) return {started:false};
   active = true;
   try { return {started:true,value:await operation()}; }
   finally { active = false; }
  },
  get busy() { return active; }
 };
}
