/** Keep private quote-message drafts bound to the conversation where typed.
 * A late send response must not clear text typed for a different thread. */
export function draftAfterThreadChange(
 currentThreadId: string,
 nextThreadId: string,
 draft: string,
): string {
 return currentThreadId === nextThreadId ? draft : '';
}

/** Only clear a sent draft if the composer still contains that exact draft
 * for the same conversation. */
export function shouldClearSentDraft(
 sentThreadId: string,
 activeThreadId: string,
 sentText: string,
 currentDraft: string,
): boolean {
 return sentThreadId === activeThreadId && sentText === currentDraft.trim();
}
