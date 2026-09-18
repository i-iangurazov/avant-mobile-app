import {setAdministrator} from '../server/admin-roles';
import {registerFixture} from './fixtures';
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
 await rejects(() => updateCustomerProfile(pool,id,{name:'Test',phone:`+996706${suffix}`},[`+996706${suffix}`],secret),400);
 const p2=await proof('phone_change',`+996706${suffix}`,id);
 await rejects(() => consumePhoneProof(pool,secret,'register',`+996706${suffix}`,null,p2),400);
 await rejects(() => consumePhoneProof(pool,secret,'phone_change',phone,id,p2),400);
 await rejects(() => consumePhoneProof(pool,secret,'phone_change',`+996706${suffix}`,'another-account',p2),400);
 await pool.query("UPDATE app_phone_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",[p2.challengeId]);
 await rejects(() => consumePhoneProof(pool,secret,'phone_change',`+996706${suffix}`,id,p2),400);
 const p3=await proof('phone_change',`+996707${suffix}`,id);
 for(let i=0;i<5;i++) await rejects(()=>consumePhoneProof(pool,secret,'phone_change',`+996707${suffix}`,id,{...p3,code:'bad'}),400);
 await rejects(()=>consumePhoneProof(pool,secret,'phone_change',`+996707${suffix}`,id,p3),400);
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
 await rejects(()=>requireSession(pool,signedIn.session.accessToken.slice(0,-5)+'xxxxx',secret),401);
 const target=await registerFixture(pool,{name:'Role target',phone:`+996709${suffix}`,password:'new-password'},secret);
 const hashes=await pool.query('SELECT password_hash FROM app_customers WHERE id=ANY($1::text[])',[[id,target.user.id]]);assert.notEqual(hashes.rows[0].password_hash,hashes.rows[1].password_hash);assertions++;
 await rejects(()=>setAdministrator(pool,id,target.user.id,true,'fixture-ticket'),403);
 await pool.query("UPDATE app_account_roles SET is_active=true WHERE account_id=$1 AND role='admin'",[id]);
 await pool.query('UPDATE app_customers SET phone_verified_at=NULL WHERE id=$1',[target.user.id]);
 await rejects(()=>setAdministrator(pool,id,target.user.id,true,'fixture-ticket'),409);
 await pool.query('UPDATE app_customers SET phone_verified_at=now() WHERE id=$1',[target.user.id]);
 await setAdministrator(pool,id,target.user.id,true,'fixture-ticket');assert.equal(await hasAdminAccess(pool,target.user.id),true);assertions++;
 assert.equal(Number((await pool.query("SELECT count(*) FROM app_admin_audit_log WHERE action='admin.role_changed' AND entity_id=$1",[target.user.id])).rows[0].count),1);assertions++;
 await setAdministrator(pool,id,target.user.id,false,'fixture-revoke');await rejects(()=>requireSession(pool,target.session.accessToken,secret),401);
 await rejects(()=>refreshSession(pool,target.session.refreshToken,secret),401);
 const identity=randomUUID();
 await rateLimit(pool,'test',identity,2,60000); await rateLimit(pool,'test',identity,2,60000);
 await rejects(()=>rateLimit(pool,'test',identity,2,60000),429);
 console.log(JSON.stringify({suite:'security',assertions,status:'PASS',sms:'injected in-memory test adapter; no external traffic'}));
} finally { await pool.end(); }

}
void main().catch(error => { console.error(error); process.exitCode=1; });
