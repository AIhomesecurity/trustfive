export const SOCIAL_SECTIONS=[
 {id:'neighbourhood',label:'Neighbourhood'},
 {id:'trade',label:'Trade Network'},
 {id:'advice',label:'Questions & Advice'},
 {id:'events',label:'Events'},
 {id:'saved',label:'Saved'}
] as const;

export type SocialSection=(typeof SOCIAL_SECTIONS)[number]['id'];

export function socialSectionFromQuery(values:readonly string[]):SocialSection{
 return values.length===1
  ?SOCIAL_SECTIONS.find(section=>section.id===values[0])?.id??'neighbourhood'
  :'neighbourhood';
}

export function socialSectionHref(section:SocialSection):string{
 return section==='neighbourhood'?'/community/social':'/community/social?tab='+section;
}
