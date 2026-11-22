/** Session identity transitions require clearing private account-scoped UI.
 * Re-focusing the same signed-in session must not discard an unsent draft.
 * INITIAL_SESSION is handled by the initial authenticated getUser call.
 */
export function socialNeedsAuthRecheck(
 event:string,
 currentUserId='',
 eventUserId=''
):boolean{
 if(event==='SIGNED_OUT')return true;
 if(event==='SIGNED_IN')return !eventUserId||currentUserId!==eventUserId;
 return event==='USER_UPDATED';
}
