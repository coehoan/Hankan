import {describe,expect,it} from 'vitest';
import {parseAuthInput} from './validation';
describe('username authentication input',()=>{
 it('normalizes_username_without_changing_password',()=>{expect(parseAuthInput('sign-in',{username:'  Fresh_User1 ',password:' secret-pass '})).toEqual({action:'sign-in',username:'fresh_user1',password:' secret-pass '})});
 it.each(['abc','a'.repeat(25),'사용자아이디','name@example.com','name space','name-test'])('rejects_invalid_username_%s',username=>{expect(()=>parseAuthInput('sign-up',{username,password:'secure-pass'})).toThrowError(expect.objectContaining({code:'validation'}))});
 it.each(['short','가'.repeat(25)])('rejects_invalid_password',password=>{expect(()=>parseAuthInput('sign-up',{username:'testuser',password})).toThrowError(expect.objectContaining({code:'validation'}))});
 it('requires_matching_confirmation_on_server',()=>{expect(()=>parseAuthInput('update-password',{password:'new-password',confirmPassword:'other-password'})).toThrowError(expect.objectContaining({code:'validation'}));expect(()=>parseAuthInput('update-password',{password:'new-password'})).toThrowError(expect.objectContaining({code:'validation'}));expect(parseAuthInput('update-password',{password:'new-password',confirmPassword:'new-password'})).toEqual({action:'update-password',password:'new-password',confirmPassword:'new-password'})});
 it('ignores_supplied_identity_and_role',()=>{expect(parseAuthInput('sign-in',{username:'testuser',password:'secure-pass',userId:'victim',role:'owner'})).toEqual({action:'sign-in',username:'testuser',password:'secure-pass'})});
 it('rejects_non_object_json',()=>{expect(()=>parseAuthInput('sign-in',null)).toThrowError(expect.objectContaining({code:'validation'}))});
});
