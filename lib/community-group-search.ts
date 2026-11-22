/** Client-side discovery within the bounded, already-authorised group list. */
export type SearchableCommunityGroup={name:string;description:string;area_id:string};
export type SearchableArea={id:string;area_name:string;city?:string};

/** Ignore accidental extra spaces and accent differences in mobile searches. */
function normalizeSearchText(value:string):string{
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
}

export function filterLoadedCommunityGroups<T extends SearchableCommunityGroup>(
 groups:readonly T[],areas:readonly SearchableArea[],query:string
):T[]{
 const term=normalizeSearchText(query);
 if(!term)return [...groups];
 const areaNames=new Map(areas.map(area=>[area.id,normalizeSearchText([area.area_name,area.city||''].join(' '))]));
 return groups.filter(group=>
  [group.name,group.description,areaNames.get(group.area_id)||'']
   .some(value=>normalizeSearchText(value).includes(term))
 );
}
