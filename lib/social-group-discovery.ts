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
