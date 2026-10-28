import {it,expect} from 'vitest';
import {resetAccountPassword,type PasswordDirectory} from './admin-reset';
it('admin_reset_changes_only_target_then_revokes_sessions',async()=>{
 const changed:string[]=[],revoked:string[]=[];const directory:PasswordDirectory={async list(page){return page===1?{users:[{id:'other',email:'otheruser@accounts.hankan.invalid'}],hasMore:true}:{users:[{id:'target',email:'testuser@accounts.hankan.invalid'}],hasMore:false}},async setPassword(id){changed.push(id)},async revokeSessions(email){revoked.push(email)}};
 await resetAccountPassword(' TESTUSER ','new-password','new-password',directory);expect(changed).toEqual(['target']);expect(revoked).toEqual(['testuser@accounts.hankan.invalid']);
});
it('mismatch_and_unknown_account_do_not_update_any_account',async()=>{
 let updates=0;const directory:PasswordDirectory={async list(){return {users:[],hasMore:false}},async setPassword(){updates++},async revokeSessions(){throw new Error('Should not run')}};
 await expect(resetAccountPassword('testuser','new-password','different-password',directory)).rejects.toMatchObject({code:'validation'});
 await expect(resetAccountPassword('testuser','new-password','new-password',directory)).rejects.toMatchObject({code:'not_found'});expect(updates).toBe(0);
});
