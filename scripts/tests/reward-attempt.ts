import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createPool,ensureSchema} from '../server/db';
import {registerFixture,assertTestDatabase} from './fixtures';
import {createManualAdjustment,redeemReward,getLoyaltyBalances} from '../server/loyalty';
import {createRewardAttemptClient,readRewardAttempt,rewardAttemptKey} from '../../src/lib/rewards/rewardAttempt';
const pool=createPool(process.env.TEST_DATABASE_URL||'')!;
const checks:string[]=[];const record=(name:string)=>checks.push(name);
async function main(){try{
 assertTestDatabase(pool);await ensureSchema(pool);
 const account=await registerFixture(pool,{name:'Retry Test',phone:`+996704${String(Date.now()).slice(-6)}`,password:'test-password',accountType:'plumber',plumberApplication:{fullName:'Retry Test',city:'Бишкек',workingDistricts:['Test'],specializations:['Test'],experienceYears:1,programConsent:true,dataProcessingConsent:true}},'fixture-secret');
 const id=account.user.id,plumber=account.user.plumber!.id;
 await pool.query("UPDATE app_plumber_profiles SET application_status='approved' WHERE id=$1",[plumber]);
 await createManualAdjustment(pool,id,plumber,'2000','Isolated retry fixture');
 const reward={rewardId:randomUUID(),title:'Retry fixture'};
 await pool.query("INSERT INTO app_rewards(id,title,description,cost_minor,availability_count) VALUES($1,$2,'Test',100,20)",[reward.rewardId,reward.title]);
 // Reproduce previous screen behaviour: a new key on each confirmation after lost ACK.
 await redeemReward(pool,id,reward.rewardId,'baseline-'+randomUUID());await redeemReward(pool,id,reward.rewardId,'baseline-'+randomUUID());
 const baselineCount=Number((await pool.query('SELECT count(*) FROM app_reward_redemptions WHERE plumber_id=$1',[plumber])).rows[0].count);assert.equal(baselineCount,2);record('Before: new client keys create two redemptions');
 const values=new Map<string,string>();const storage={getItem:async(k:string)=>values.get(k)||null,setItem:async(k:string,v:string)=>{values.set(k,v);},removeItem:async(k:string)=>{values.delete(k);}};
 let calls=0;const send=async(rewardId:string,key:string)=>{calls++;const result=await redeemReward(pool,id,rewardId,key);if(calls===1)throw new Error('ACK lost after COMMIT');return result;};
 const first=createRewardAttemptClient(storage);await assert.rejects(()=>first.submit(id,reward,send),/ACK lost/);record('Loss after committed debit preserves durable attempt');
 const pending=await readRewardAttempt(storage,id);assert.ok(pending?.key);await assert.rejects(()=>first.acknowledge(id));record('Unknown result cannot be discarded');
 const restarted=createRewardAttemptClient(storage);const repeated=await Promise.all(Array.from({length:20},()=>restarted.submit(id,reward,send)));assert.equal(new Set(repeated.map(x=>x.id)).size,1);assert.equal(calls,2);record('Reload and 20 parallel retries produce one server redemption');
 const rows=await pool.query('SELECT id FROM app_reward_redemptions WHERE plumber_id=$1 AND client_request_id=$2',[plumber,pending!.key]);assert.equal(rows.rowCount,1);assert.equal((await getLoyaltyBalances(pool,plumber)).availableMinor,'1700');record('Exactly one ledger debit of 100 for recovered request');
 const ledger=await pool.query('SELECT count(*) FROM app_loyalty_transactions WHERE reward_redemption_id=$1',[rows.rows[0].id]);assert.equal(Number(ledger.rows[0].count),1);
 await restarted.submit(id,reward,send);assert.equal(calls,2);record('Accepted receipt remains until explicit acknowledgment');
 assert.equal(await readRewardAttempt(storage,'different-account'),null);assert.equal(await storage.getItem(rewardAttemptKey('different-account')),null);record('Account B cannot recover account A attempt');
 await assert.rejects(()=>restarted.submit(id,{rewardId:randomUUID(),title:'Other'},send));record('Cannot replace unresolved reward');
 await restarted.acknowledge(id);assert.equal(await readRewardAttempt(storage,id),null);await restarted.submit(id,reward,send);assert.equal(calls,3);record('Only explicit acknowledgment permits next purchase');
 const failed=createRewardAttemptClient({...storage,setItem:async()=>{throw new Error('Disk full');}});let sent=false;await assert.rejects(()=>failed.submit('storage-failure',reward,async()=>{sent=true;return repeated[0];}));assert.equal(sent,false);record('No debit when durable save fails');
 await restarted.acknowledge(id);
 await assert.rejects(()=>restarted.submit(id,{rewardId:randomUUID(),title:'Unavailable'},async(r,k)=>{try{return await redeemReward(pool,id,r,k);}catch(e:any){throw {payload:{requestNotCreated:e.requestNotCreated}};}}));assert.equal(await readRewardAttempt(storage,id),null);record('Authoritative no-operation rejection permits corrected selection');
 writeFileSync((process.env.REGRESSION_EVIDENCE_DIR || 'artifacts/device-20260921/')+'reward-retry.json',JSON.stringify({status:'PASS',checks,beforeOperations:baselineCount,recoveredOperations:rows.rowCount,recoveredLedgerDebits:Number(ledger.rows[0].count),scope:'isolated PostgreSQL; real ledger + client recovery module'},null,2));console.log({status:'PASS',checks});
}finally{await pool.end();}}
void main().catch(e=>{console.error(e);process.exitCode=1;});
