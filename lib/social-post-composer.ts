/** Shared validation for the authenticated TrustFive neighbourhood composer. */
export type SocialPublishInput={
 authorId:string;areaId:string;availableAreaIds:readonly string[];body:string;
};
export function socialPostValidationError(input:SocialPublishInput):string|null{
 if(!input.authorId)return 'Sign in before posting to TrustFive Social.';
 if(!input.areaId||!input.availableAreaIds.includes(input.areaId))return 'Choose an available neighbourhood for your post.';
 const body=input.body.trim();
 if(body.length<8)return 'Write at least 8 characters for your post.';
 if(body.length>3000)return 'Keep your post to 3,000 characters or fewer.';
 return null;
}
