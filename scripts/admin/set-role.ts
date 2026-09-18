import {createPool} from '../server/db';
import {setAdministrator} from '../server/admin-roles';
const [actorId,accountId,action,ticket,...rest]=process.argv.slice(2);
if(!actorId||!accountId||!['grant','revoke'].includes(action)||!ticket||rest.length)throw Error('Usage: DATABASE_URL=… tsx scripts/admin/set-role.ts ACTOR_ID ACCOUNT_ID grant|revoke CHANGE_TICKET');
const pool=createPool(process.env.DATABASE_URL||'');if(!pool)throw Error('DATABASE_URL required');
setAdministrator(pool,actorId,accountId,action==='grant',ticket).then(()=>console.log('Selected account role updated and audited.')).finally(()=>pool.end()).catch(error=>{console.error(error instanceof Error?error.message:'Role update failed');process.exitCode=1;});
