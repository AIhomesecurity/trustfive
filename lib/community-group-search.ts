/** Client-side discovery within the bounded, already-authorised group list. */
export type SearchableCommunityGroup={name:string;description:string;area_id:string};
export type SearchableArea={id:string;area_name:string};
export function filterLoadedCommunityGroups<T extends SearchableCommunityGroup>(
 groups:readonly T[],areas:readonly SearchableArea[],query:string
):T[]{
 const term=query.trim().toLocaleLowerCase();
 if(!term)return [...groups];
 const areaNames=new Map(areas.map(area=>[area.id,area.area_name.toLocaleLowerCase()]));
 return groups.filter(group=>
  [group.name,group.description,areaNames.get(group.area_id)||'']
   .some(value=>value.toLocaleLowerCase().includes(term))
 );
}
