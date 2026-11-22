/** Client-side guard only; database validation remains authoritative. */
export function communityGroupDraftError(name:string,description:string):string|null {
 // Count meaningful characters, not whitespace padding between words or lines.
 const meaningfulName=name.replace(/\s/gu,'');
 const meaningfulDescription=description.replace(/\s/gu,'');
 if(meaningfulName.length<4)return 'Enter a group name with at least 4 non-space characters.';
 if(meaningfulDescription.length<15)return 'Describe your group using at least 15 non-space characters.';
 return null;
}
