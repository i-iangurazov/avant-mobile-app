import {readFileSync,writeFileSync} from 'node:fs';
import {createPool} from '../server/db';
import {loginCustomer} from '../server/auth';
import {assertTestDatabase} from './fixtures';
const pool=createPool(process.env.TEST_DATABASE_URL || '')!;
async function main(){try{assertTestDatabase(pool);const path='/private/tmp/avantehnik-remediation-sessions.json';const sessions=JSON.parse(readFileSync(path,'utf8'));for(const role of ['customer','plumber','admin']){const result=await loginCustomer(pool,{phone:sessions[role].user.phone,password:'test-password'},'remediation-local-secret-not-production');sessions[role]={...result.session,user:result.user};}writeFileSync(path,JSON.stringify(sessions),{mode:0o600});console.log('Refreshed isolated fixture sessions.');}finally{await pool.end();}}
void main().catch(e=>{console.error(e);process.exitCode=1;});
