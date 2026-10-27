import type { ErrorCode } from './contracts';

const statusByCode:Record<ErrorCode,number>={unauthenticated:401,forbidden:403,not_found:404,conflict:409,validation:422,provider_unconfigured:503,provider_failed:502,internal:500};

export class AppError extends Error {
 readonly code:ErrorCode;
 readonly status:number;
 constructor(code:ErrorCode,message:string){super(message);this.name='AppError';this.code=code;this.status=statusByCode[code]}
}

export function errorResponse(error:unknown):Response{
 const safe=error instanceof AppError?error:new AppError('internal','잠시 문제가 생겼어요. 다시 시도해 주세요.');
 return Response.json({error:{code:safe.code,message:safe.message}},{status:safe.status,headers:{'Cache-Control':'private, no-store'}});
}
