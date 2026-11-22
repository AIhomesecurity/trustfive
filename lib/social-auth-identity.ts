/** Auth state changes which require re-checking the actual signed-in user.
 * INITIAL_SESSION is handled by the initial getUser call; token refresh
 * for the same user doesn't need to discard private UI state.
 */
export function socialNeedsAuthRecheck(event:string):boolean{
 return event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED';
}
