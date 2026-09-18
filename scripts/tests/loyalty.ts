import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createPool,ensureSchema} from '../server/db';
import {registerFixture,assertTestDatabase} from './fixtures';
import {listLoyaltyTransactions,getLoyaltyBalances,createManualAdjustment,redeemReward} from '../server/loyalty';
const pool=createPool(process.env.TEST_DATABASE_URL || '')!;
let checks=0;
async function main(){try{
 assertTestDatabase(pool);await ensureSchema(pool);
 const suffix=String(Date.now()).slice(-6);
 const account=await registerFixture(pool,{name:'Ledger Test',phone:`+996703${suffix}`,password:'test-password',accountType:'plumber',plumberApplication:{fullName:'Ledger Test',city:'Бишкек',workingDistricts:['Тест'],specializations:['Тест'],experienceYears:1,programConsent:true,dataProcessingConsent:true}},'fixture-secret');
 const plumber=account.user.plumber!.id;
 await pool.query("UPDATE app_plumber_profiles SET application_status='approved' WHERE id=$1",[plumber]);
 for(let i=0;i<137;i++) await createManualAdjustment(pool,account.user.id,plumber,'100',`Fixture operation ${i}`);
 // Timestamp ties are intentional; PostgreSQL microseconds must not be truncated in cursors.
 await pool.query("UPDATE app_loyalty_transactions SET created_at='2026-09-18 12:00:00.123456+00' WHERE plumber_id=$1",[plumber]);
 const all=[];let cursor:string|undefined;
 do{const page=await listLoyaltyTransactions(pool,account.user.id,{limit:30,cursor});all.push(...page);cursor=page.length===30?page.at(-1)?.cursor:undefined;}while(cursor);
 assert.equal(all.length,137);assert.equal(new Set(all.map(x=>x.id)).size,137);checks+=2;
 assert.equal((await listLoyaltyTransactions(pool,account.user.id)).length,30);checks++;
 const balance=await getLoyaltyBalances(pool,plumber);
 assert.equal(all.reduce((sum,item)=>sum+BigInt(item.amountMinor),0n).toString(),balance.availableMinor);checks++;
 assert.equal((await listLoyaltyTransactions(pool,account.user.id,{status:'pending'})).length,0);checks++;
 await assert.rejects(()=>listLoyaltyTransactions(pool,account.user.id,{cursor:'bad'}));checks++;
 await assert.rejects(()=>listLoyaltyTransactions(pool,account.user.id,{status:'injected'}));checks++;
 const rewards=[randomUUID(),randomUUID()];
 for(const id of rewards)await pool.query("INSERT INTO app_rewards(id,title,description,cost_minor,availability_count) VALUES($1,'Fixture','Fixture',100,10)",[id]);
 const key=randomUUID();const first=await redeemReward(pool,account.user.id,rewards[0],key);
 if(process.env.REPRO_BASELINE_REWARD==='1') {
  const changed=await redeemReward(pool,account.user.id,rewards[1],key);
  writeFileSync('docs/production-readiness/2026-09-18-remediation/evidence/D18-before.json',JSON.stringify({first,changed,defect:'Different reward under same request key silently returns first redemption'} ,null,2));
  assert.equal(changed.id,first.id); console.log('D18 reproduced on unchanged reward idempotency implementation');
 } else {
  await assert.rejects(()=>redeemReward(pool,account.user.id,rewards[1],key),(e:any)=>e.statusCode===409);checks++;
  const repeats=await Promise.all(Array.from({length:20},()=>redeemReward(pool,account.user.id,rewards[0],key)));
  assert.equal(new Set(repeats.map(x=>x.id)).size,1);checks++;
 }
 console.log(JSON.stringify({suite:'loyalty-history',checks,status:'PASS',records:137,pages:5,source:'isolated real ledger mutations, no production data'}));
}finally{await pool.end();}}
void main().catch(e=>{console.error(e);process.exitCode=1;});
