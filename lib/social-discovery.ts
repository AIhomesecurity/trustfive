/**
 * TrustFive Social discovery is built from real published neighbourhood posts.
 * Do not infer discussion categories, authors, verification or professional status
 * from free-text content. Those require explicit, authorised backend fields.
 */
export type SocialPostSummary={
 id:string;area_id:string;body:string;created_at:string;visibility:string;
};
export type SocialArea={id:string;area_name:string;city:string};
export type FeedOrder='recent'|'oldest';

export function selectSocialPosts(
 posts:readonly SocialPostSummary[],
 options:{areaId:string;query:string;order:FeedOrder;limit?:number}
):SocialPostSummary[]{
 const term=options.query.trim().toLocaleLowerCase();
 const limit=Math.min(100,Math.max(1,Math.floor(options.limit??30)));
 return posts.filter(post=>post.visibility==='published'
  &&(!options.areaId||post.area_id===options.areaId)
  &&(!term||post.body.toLocaleLowerCase().includes(term))
  &&Number.isFinite(Date.parse(post.created_at))
 ).sort((a,b)=>{
  const difference=Date.parse(b.created_at)-Date.parse(a.created_at);
  return (options.order==='oldest'?-difference:difference)||a.id.localeCompare(b.id);
 }).slice(0,limit);
}

export function findSocialArea(areas:readonly SocialArea[],areaId:string):SocialArea|undefined{
 return areas.find(area=>area.id===areaId);
}

export function readablePostDate(timestamp:string):string{
 const date=new Date(timestamp);
 return Number.isFinite(date.getTime())?date.toLocaleString('en-GB'):'Date unavailable';
}
