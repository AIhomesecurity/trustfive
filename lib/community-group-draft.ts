/** Client-side guard only; database validation remains authoritative. */
export function communityGroupDraftError(name:string,description:string):string|null {
 const cleanName=name.trim();
 const cleanDescription=description.trim();
 if(cleanName.length<4)return 'Enter a group name with at least 4 non-space characters.';
 if(cleanDescription.length<15)return 'Describe your group using at least 15 non-space characters.';
 return null;
}
