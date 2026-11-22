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

export type SocialReportCategory='spam'|'abuse'|'privacy'|'other';
export const SOCIAL_REPORT_CATEGORIES:readonly SocialReportCategory[]=['spam','abuse','privacy','other'];
export function socialReportError(category:string,details:string):string|null{
 if(!SOCIAL_REPORT_CATEGORIES.includes(category as SocialReportCategory))return 'Choose a valid reason for reporting.';
 if(details.length>1200)return 'Keep report details to 1,200 characters or fewer.';
 return null;
}
