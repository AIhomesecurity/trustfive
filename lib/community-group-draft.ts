/** Client-side guard only; database validation remains authoritative. */
/** Count characters excluding Unicode whitespace for accurate form guidance. */
export function communityGroupMeaningfulLength(value:string):number {
 return value.replace(/\s/gu,'').length;
}

export function communityGroupDraftError(name:string,description:string):string|null {
 // Count meaningful characters, not whitespace padding between words or lines.
 const meaningfulName=communityGroupMeaningfulLength(name);
 const meaningfulDescription=communityGroupMeaningfulLength(description);
 if(meaningfulName<4)return 'Enter a group name with at least 4 non-space characters.';
 if(meaningfulDescription<15)return 'Describe your group using at least 15 non-space characters.';
 return null;
}
