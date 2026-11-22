/** Distinguish repeated group actions for assistive technology. */
export function communityGroupActionLabel(action:'join'|'open'|'close'|'view',groupName:string):string{
 const name=groupName.trim()||'unnamed group';
 if(action==='join')return `Join ${name}`;
 if(action==='view')return `View group page for ${name}`;
 if(action==='close')return `Close posts for ${name}`;
 return `Open posts for ${name}`;
}

/** Disable actions while another group write is in progress. */
export function communityGroupActionDisabled(busy:boolean,loading:boolean):boolean{
 return busy||loading;
}
