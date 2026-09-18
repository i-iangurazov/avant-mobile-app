import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPool, ensureSchema } from '../server/db';
import { registerCustomer, loginCustomer, updateCustomerProfile, hasAdminAccess, requireSession, refreshSession, revokeSession, resetPassword } from '../server/auth';
import { createPhoneChallenge, consumePhoneProof, rateLimit, type PhoneAction } from '../server/security';

const url = process.env.TEST_DATABASE_URL || '';
if (!/^postgres(?:ql)?:\/\/[^/]*@127\.0\.0\.1:55448\/remediation$/.test(url)) throw new Error('Only isolated remediation DB on 55448 is allowed');
const pool = createPool(url)!; const secret = 'isolated-test-secret-not-production';
const suffix = String(Date.now()).slice(-6); const phone = `+996700${suffix}`;
let assertions = 0;
async function rejects(fn: () => Promise<unknown>, status: number) { await assert.rejects(fn, (e: any) => e.statusCode === status); assertions++; }
async function proof(action: PhoneAction, number: string, accountId: string | null = null) {
  let code = '';
  const challenge = await createPhoneChallenge(pool, secret, async (message) => { code = message.code; }, action, number, accountId);
  return { challengeId: challenge.challengeId, code };
}
async function main() {
try {
 await ensureSchema(pool);
 await rejects(() => registerCustomer(pool, {name:'Test',phone,password:'test-password'},secret,[phone]),400);
 const p = await proof('register',phone);
 await rejects(() => registerCustomer(pool,{name:'Test',phone,password:'test-password',phoneProof:{...p,code:'invalid'}},secret,[phone]),400);
 const registration = await registerCustomer(pool,{name:'Test',phone,password:'test-password',phoneProof:p},secret,[phone]);
 assert.equal(registration.user.isAdmin,false); assert.equal(await hasAdminAccess(pool,registration.user.id,[phone]),false); assertions+=2;
 await rejects(() => consumePhoneProof(pool,secret,'register',phone,null,p),400);
 const id=registration.user.id;
 assert.equal(await requireSession(pool,registration.session.accessToken,secret),id); assertions++;
 await rejects(() => updateCustomerProfile(pool,id,{name:'Test',phone:'+996700999991'},['+996700999991'],secret),400);
 const p2=await proof('phone_change','+996700999991',id);
 await rejects(() => consumePhoneProof(pool,secret,'register','+996700999991',null,p2),400);
 await rejects(() => consumePhoneProof(pool,secret,'phone_change',phone,id,p2),400);
 await rejects(() => consumePhoneProof(pool,secret,'phone_change','+996700999991','another-account',p2),400);
 await pool.query("UPDATE app_phone_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",[p2.challengeId]);
 await rejects(() => consumePhoneProof(pool,secret,'phone_change','+996700999991',id,p2),400);
 const p3=await proof('phone_change','+996700999992',id);
 for(let i=0;i<5;i++) await rejects(()=>consumePhoneProof(pool,secret,'phone_change','+996700999992',id,{...p3,code:'bad'}),400);
 await rejects(()=>consumePhoneProof(pool,secret,'phone_change','+996700999992',id,p3),400);
 await pool.query("INSERT INTO app_account_roles(account_id,role) VALUES($1,'admin')",[id]);
 const admin = await loginCustomer(pool,{phone,password:'test-password'},secret);
 assert.equal(admin.user.isAdmin,true); assertions++;
 await pool.query("UPDATE app_account_roles SET is_active=false WHERE account_id=$1 AND role='admin'",[id]);
 const refreshed=await refreshSession(pool,admin.session.refreshToken,secret);
 assert.equal(refreshed.user.isAdmin,false); assert.equal(await hasAdminAccess(pool,id,[phone]),false); assertions+=2;
 await rejects(()=>refreshSession(pool,admin.session.refreshToken,secret),401);
 await rejects(()=>requireSession(pool,admin.session.accessToken,secret),401);
 await revokeSession(pool,refreshed.session.accessToken,secret);
 await rejects(()=>requireSession(pool,refreshed.session.accessToken,secret),401);
 const reset=await proof('password_reset',phone,id);
 await resetPassword(pool,phone,'new-password',reset,secret);
 await rejects(()=>loginCustomer(pool,{phone,password:'test-password'},secret),401);
 await rejects(()=>requireSession(pool,registration.session.accessToken,secret),401);
 const signedIn=await loginCustomer(pool,{phone,password:'new-password'},secret);
 assert.equal(signedIn.user.id,id); assertions++;
 const identity=randomUUID();
 await rateLimit(pool,'test',identity,2,60000); await rateLimit(pool,'test',identity,2,60000);
 await rejects(()=>rateLimit(pool,'test',identity,2,60000),429);
 console.log(JSON.stringify({suite:'security',assertions,status:'PASS',sms:'injected in-memory test adapter; no external traffic'}));
} finally { await pool.end(); }

}
void main().catch(error => { console.error(error); process.exitCode=1; });
