/** Return focus to the group opener when it remains visible; otherwise to search.
 * Filtering can unmount an opener while the member is reading group posts.
 */
export function restoreGroupListFocus(
 opener:Pick<HTMLButtonElement,'isConnected'|'disabled'|'focus'>|null,
 search:Pick<HTMLInputElement,'focus'>|null,
):'opener'|'search'|'none'{
 if(opener?.isConnected&&!opener.disabled){opener.focus();return 'opener';}
 if(search){search.focus();return 'search';}
 return 'none';
}
