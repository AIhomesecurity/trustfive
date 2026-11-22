/** Client-side guard only; database validation remains authoritative. */
/** Count visible meaningful characters, excluding whitespace and invisible
 * formatting controls that otherwise inflate minimum-length guidance. */
export function communityGroupMeaningfulLength(value:string):number {
 return Array.from(value.replace(/[\s\p{Cf}\p{Cc}]/gu,'')).length;
}

export function communityGroupDraftError(name:string,description:string):string|null {
 const meaningfulName=communityGroupMeaningfulLength(name);
 const meaningfulDescription=communityGroupMeaningfulLength(description);
 if(meaningfulName<4)return 'Enter a group name with at least 4 non-space characters.';
 if(meaningfulDescription<15)return 'Describe your group using at least 15 non-space characters.';
 return null;
}
