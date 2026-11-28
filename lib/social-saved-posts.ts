import type {SocialPostSummary} from './social-discovery';
export type SocialSavedRecord={post_id:string;saved_at:string};

/** Restore private bookmark order; no hidden or unavailable post is displayed. */
export function socialVisibleSavedPosts(
 records:readonly SocialSavedRecord[],posts:readonly SocialPostSummary[]
):SocialPostSummary[]{
 const available=new Map(posts.filter(post=>post.visibility==='published').map(post=>[post.id,post]));
 const seen=new Set<string>();
 const result:SocialPostSummary[]=[];
 for(const record of records){
  if(seen.has(record.post_id))continue;
  seen.add(record.post_id);
  const post=available.get(record.post_id);
  if(post)result.push(post);
 }
 return result;
}
