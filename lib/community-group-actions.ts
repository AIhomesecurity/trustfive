/** Distinguish repeated group actions for assistive technology. */
export function communityGroupActionLabel(action:'join'|'open',groupName:string):string{
 const name=groupName.trim()||'unnamed group';
 return action==='join'? `Join ${name}` : `Open posts for ${name}`;
}

/** Disable actions while another group write is in progress. */
export function communityGroupActionDisabled(busy:boolean,loading:boolean):boolean{
 return busy||loading;
}
