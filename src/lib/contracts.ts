export type MemberRole='owner'|'member';
export type AccessContext={userId:string;fridgeId:string;role:MemberRole};
export type ErrorCode='unauthenticated'|'forbidden'|'not_found'|'conflict'|'validation'|'provider_unconfigured'|'provider_failed'|'internal';
export type JsonResult<T>={data:T}|{error:{code:ErrorCode;message:string}};
