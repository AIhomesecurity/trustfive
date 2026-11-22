/** Shared client guards; Supabase RLS/RPC remains the authoritative permission boundary. */
export type SocialReactionKind='like'|'support';
export type SocialReactionSummary={
 post_id:string;likes:number;supports:number;my_reaction:string|null
};
export type SocialComment={
 id:string;post_id:string;body:string;created_at:string
};

export function socialReplyError(text:string):string|null{
 const cleaned=text.trim();
 if(cleaned.length<2)return 'Write at least two characters.';
 if(cleaned.length>1500)return 'Keep replies to 1,500 characters or fewer.';
 return null;
}

export function socialReactionIsActive(current:string|null,kind:SocialReactionKind):boolean{
 return current===kind;
}

export function socialPostReplyCount(comments:readonly SocialComment[],postId:string):number{
 return comments.filter(comment=>comment.post_id===postId).length;
}
