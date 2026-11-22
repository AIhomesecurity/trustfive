/** Display a group's listed area without implying that the territory is verified. */
export type CommunityGroupArea={id:string;area_name:string;city?:string|null};
export function communityGroupLocationLabel(areaId:string,areas:readonly CommunityGroupArea[]):string{
 const area=areas.find(item=>item.id===areaId);
 if(!area)return 'Area unavailable';
 const parts=[area.area_name,area.city].map(value=>value?.trim()||'').filter(Boolean);
 return parts.length?parts.join(', '):'Area unavailable';
}
