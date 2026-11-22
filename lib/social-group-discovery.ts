import type {SocialArea} from './social-discovery';

export type SocialGroupSummary={
 id:string;area_id:string;name:string;description:string;created_at:string;
};

/** Groups are public community spaces; title words never verify a professional. */
export function socialGroupAreaLabel(groupsAreaId:string,areas:readonly SocialArea[]):string{
 const area=areas.find(item=>item.id===groupsAreaId);
 return area?area.area_name+', '+area.city:'Community area';
}

export function socialGroupSearchPattern(query:string):string|null{
 const term=query.trim();
 if(!term)return null;
 const safe=term.slice(0,120).replace(/[\\%_]/g,char=>'\\'+char);
 return '%'+safe+'%';
}

/** Build a bounded set of group IDs from the member's own authorised rows. */
export function socialOwnGroupIds(
 memberships:readonly {group_id:string;user_id:string}[],currentUserId:string
):string[]{
 if(!currentUserId)return [];
 return [...new Set(memberships.filter(item=>item.user_id===currentUserId)
  .map(item=>item.group_id).filter(Boolean))].slice(0,200);
}
