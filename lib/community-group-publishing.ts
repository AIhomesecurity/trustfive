/** Keep the group composer and its submit handler in sync. */
export function canPublishCommunityGroupPost(input:{
 signedIn:boolean;
 selectedGroupId:string;
 memberGroupIds:readonly string[];
 body:string;
 busy:boolean;
 postsLoading:boolean;
 postsError:boolean;
}):boolean{
 const {signedIn,selectedGroupId,memberGroupIds,body,busy,postsLoading,postsError}=input;
 const trimmed=body.trim();
 return signedIn&&Boolean(selectedGroupId)&&memberGroupIds.includes(selectedGroupId)&&
  !busy&&!postsLoading&&!postsError&&trimmed.length>=8&&trimmed.length<=3000;
}
