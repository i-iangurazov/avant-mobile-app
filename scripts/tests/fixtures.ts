import type pg from 'pg';
import { registerCustomer } from '../server/auth';
import { createPhoneChallenge } from '../server/security';
export function assertTestDatabase(pool:pg.Pool) {
 const url = new URL(pool.options.connectionString || 'invalid:');
 if (!['127.0.0.1','localhost'].includes(url.hostname) || !['/remediation','/audit'].includes(url.pathname) || url.port!=='55448') throw new Error('Fixtures require isolated audit/remediation DB on 55448');
}
export async function registerFixture(pool:pg.Pool,payload:Parameters<typeof registerCustomer>[1],secret:string) {
 assertTestDatabase(pool);
 let code='';
 const challenge=await createPhoneChallenge(pool,secret,async message=>{code=message.code;},'register',payload.phone || '',null);
 return registerCustomer(pool,{...payload,phoneProof:{challengeId:challenge.challengeId,code}},secret);
}
