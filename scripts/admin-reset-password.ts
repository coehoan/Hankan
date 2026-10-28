import {emitKeypressEvents} from 'node:readline';
import {resetAccountPassword} from '../src/features/auth/admin-reset';
import {createPasswordDirectory} from '../src/features/auth/password-directory';
async function hiddenInput(prompt:string):Promise<string>{
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('터미널에서 실행하거나 --stdin으로 JSON을 전달해 주세요.');
 emitKeypressEvents(process.stdin);const oldRaw=process.stdin.isRaw;process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write(prompt);
 return new Promise((resolve,reject)=>{
  let value='';const finish=()=>{process.stdin.removeListener('keypress',key);process.stdin.setRawMode(oldRaw);process.stdin.pause();process.stdout.write('\n')};
  const key=(text:string,k:{name?:string;ctrl?:boolean;meta?:boolean})=>{
   if(k.ctrl&&k.name==='c'){finish();reject(new Error('취소했어요.'));return}
   if(k.name==='return'||k.name==='enter'){finish();resolve(value);return}
   if(k.name==='backspace'){if(value){value=Array.from(value).slice(0,-1).join('');process.stdout.write('\b \b')}return}
   if(text&&!k.ctrl&&!k.meta&&!/[\x00-\x1f\x7f]/.test(text)){value+=text;process.stdout.write('*'.repeat(Array.from(text).length))}
  };process.stdin.on('keypress',key);
 });
}
async function main(){
 const args=process.argv.slice(2),username=args[0];if(!username||args.length>2||(args[1]&&args[1]!=='--stdin'))throw new Error('사용법: npm run auth:reset-password -- 아이디');
 let password:string,confirmPassword:string;
 if(args[1]==='--stdin'){
  let body='';for await(const chunk of process.stdin){body+=chunk;if(Buffer.byteLength(body)>4096)throw new Error('입력이 너무 길어요.')}
  let input;try{input=JSON.parse(body)}catch{throw new Error('초기화 입력 형식을 확인해 주세요.')}password=input?.password;confirmPassword=input?.confirmPassword;
 }else{password=await hiddenInput('새 비밀번호: ');confirmPassword=await hiddenInput('새 비밀번호 확인: ')}
 await resetAccountPassword(username,password,confirmPassword,createPasswordDirectory());console.log('비밀번호를 초기화하고 기존 세션의 로그아웃을 요청했어요. 새 비밀번호로 로그인해 주세요.');
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'초기화하지 못했어요.');process.exitCode=1});
