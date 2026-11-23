/** TrustFive group conversation client guards. Supabase RLS is authoritative. */
export type GroupConversationSummary={
 id:string;name:string;description:string;area_id:string;
 creator_id:string;visibility:string;created_at:string;
};
export type GroupConversationPost={
 id:string;group_id:string;body:string;author_id:string;created_at:string;visibility:string;
};
export type GroupConversationMembership={group_id:string;user_id:string;role:'owner'|'member'};

export function socialGroupRouteId(value:string|string[]|undefined):string|null{
 if(typeof value!=='string')return null;
 const normalized=value.toLowerCase();
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
  ?normalized:null;
}
export function socialGroupPostError(text:string):string|null{
 const body=text.trim();
 if(body.length<8)return 'Write at least 8 characters.';
 if(body.length>3000)return 'Keep group posts to 3,000 characters or fewer.';
 return null;
}
export function socialGroupCanPublish(
 userId:string,groupId:string,membership:GroupConversationMembership|null,
 text:string
):boolean{
 return Boolean(userId&&groupId&&membership?.group_id===groupId
  &&membership.user_id===userId&&!socialGroupPostError(text));
}
export function socialGroupCanLeave(
 userId:string,membership:GroupConversationMembership|null
):boolean{
 return Boolean(userId&&membership?.user_id===userId&&membership.role==='member');
}
export function socialGroupPostPage(page:number):{from:number;to:number}{
 const bounded=Number.isFinite(page)?Math.min(100,Math.max(0,Math.floor(page))):0;
 return {from:bounded*20,to:bounded*20+20};
}
export function socialGroupVisiblePage<T extends Pick<GroupConversationPost,'group_id'|'visibility'>>(
 items:readonly T[],groupId:string
):{posts:T[];hasMore:boolean}{
 const posts=items.filter(post=>post.group_id===groupId&&post.visibility==='published');
 return {posts:posts.slice(0,20),hasMore:posts.length>20};
}

/** Membership controls disappear after a successful action. Focus must move
 * to a stable visible destination instead of the removed submit button.
 */
export type SocialGroupMembershipAction='joined'|'left';
export function socialGroupFocusTarget(action:SocialGroupMembershipAction):'composer'|'join'{
 return action==='joined'?'composer':'join';
}
