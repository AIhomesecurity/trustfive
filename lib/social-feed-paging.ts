/** Bounded server-side page of genuinely published neighbourhood posts. */
export const SOCIAL_PAGE_SIZE=20;
export const SOCIAL_MAX_SEARCH_LENGTH=120;
export type SocialFeedOrder='recent'|'oldest';

/**
 * Escape LIKE wildcards and the escape character so a person's literal
 * search (for example "100% CCTV") cannot expand into a wildcard search.
 * PostgREST ilike uses PostgreSQL LIKE semantics, including backslash escapes.
 */
export function socialSearchPattern(input:string):string{
 const literal=input.trim().slice(0,SOCIAL_MAX_SEARCH_LENGTH)
  .replace(/[\\%_]/g,character=>'\\'+character);
 return '%'+literal+'%';
}

export function socialPageBounds(page:number):{from:number;to:number}{
 const index=Number.isSafeInteger(page)&&page>0?Math.min(page,500):0;
 const from=index*SOCIAL_PAGE_SIZE;
 return {from,to:from+SOCIAL_PAGE_SIZE};
}
export function socialPageRows<T>(rows:readonly T[]):{items:T[];hasMore:boolean}{
 return {items:rows.slice(0,SOCIAL_PAGE_SIZE),hasMore:rows.length>SOCIAL_PAGE_SIZE};
}
