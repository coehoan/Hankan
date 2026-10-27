import { describe, expect, it } from 'vitest';
import { parseAuthInput } from './validation';

describe('authentication input',()=>{
 it('normalizes_email_without_modifying_the_password',()=>{
  expect(parseAuthInput('sign-in',{email:'  User@Example.test ',password:' secret-pass '})).toEqual({action:'sign-in',email:'user@example.test',password:' secret-pass '});
 });
 it.each([
  {email:'not-an-email',password:'secure-pass'},
  {email:'person@example.test',password:'short'},
  {email:'person@example.test',password:'가'.repeat(25)},
 ])('rejects_invalid_credentials_%j',payload=>{
  expect(()=>parseAuthInput('sign-up',payload)).toThrowError(expect.objectContaining({code:'validation',status:422}));
 });
 it('password_reset_does_not_require_a_password',()=>{
  expect(parseAuthInput('request-reset',{email:' person@example.test '})).toEqual({action:'request-reset',email:'person@example.test'});
 });
 it('ignores_user_supplied_identity_or_role',()=>{
  expect(parseAuthInput('sign-in',{email:'user@example.test',password:'secure-pass',userId:'victim',role:'owner'})).toEqual({action:'sign-in',email:'user@example.test',password:'secure-pass'});
 });
 it('rejects_non_object_json',()=>{
  expect(()=>parseAuthInput('sign-in',null)).toThrowError(expect.objectContaining({code:'validation'}));
 });
 it('validates_update_password_without_requiring_email',()=>{
  expect(parseAuthInput('update-password',{password:'new-password'})).toEqual({action:'update-password',password:'new-password'});
 });
});
