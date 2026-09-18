import {readFileSync,writeFileSync} from 'node:fs';
import {createPool} from './scripts/server/db';
import {ingestReceipt,ingestReturn,getLoyaltyBalances,redeemReward,processRewardRedemption,releasePendingBonuses,updateLoyaltyConfiguration,getLoyaltyConfig} from './scripts/server/loyalty';
const pool=createPool('postgresql://audit@127.0.0.1:55448/audit')!;
const sessions=JSON.parse(readFileSync('/private/tmp/audit-sessions.json','utf8'));const actor=sessions.admin.user.id, plumber=sessions.plumber.user.plumber;
const results:any[]=[];const add=(id:string,data:any)=>{results.push({id,...data});console.log(JSON.stringify(results.at(-1)));};
const balance=()=>getLoyaltyBalances(pool,plumber.id);
async function main(){
 await pool.query("INSERT INTO app_loyalty_promotions(id,title,scope_type,scope_value,multiplier_bps,starts_at,ends_at,created_by) VALUES ('audit-x3','Audit x3','brand','AUDIT',30000,now()-interval '1 day',now()+interval '1 day',$1)",[actor]);
 const receipt:any={externalReceiptId:'audit-money-1',receiptNumber:'Audit-1',storeId:'audit-store',plumberIdentifier:plumber.loyaltyCode,totalMinor:'100000',purchaseAt:new Date().toISOString(),source:'fixture',items:[{externalLineId:'base',productId:'audit-base',productName:'Audit base',quantityMilli:'1000',unitPriceMinor:'40000',lineTotalMinor:'40000'},{externalLineId:'promo',productId:'audit-promo',productName:'Audit promo',brand:'AUDIT',quantityMilli:'1000',unitPriceMinor:'60000',lineTotalMinor:'60000'}]};
 const before=await balance();await ingestReceipt(pool,receipt,actor);add('base_plus_x3',{before,expectedPending:'2200',actual:await balance()});
 const retry=await ingestReceipt(pool,receipt,actor);add('receipt_exact_repeat',{created:retry.created,actual:await balance()});
 try{await ingestReceipt(pool,{...receipt,receiptNumber:'changed'},actor);add('receipt_changed_repeat',{accepted:true});}catch(e:any){add('receipt_changed_repeat',{status:e.statusCode,error:e.message,expected:409});}
 const ret:any={externalReturnId:'audit-return-1',externalReceiptId:receipt.externalReceiptId,returnAt:new Date().toISOString(),source:'fixture',items:[{externalLineId:'promo',quantityMilli:'500',amountMinor:'30000'}]};
 await ingestReturn(pool,ret,actor);add('partial_return',{expectedPending:'1300',actual:await balance()});
 await ingestReturn(pool,ret,actor);add('return_exact_repeat',{expectedPending:'1300',actual:await balance()});
 await ingestReturn(pool,{...ret,externalReturnId:'audit-return-2'},actor);add('full_promo_return',{expectedPending:'400',actual:await balance()});
 await pool.query("UPDATE app_loyalty_transactions SET available_at=now()-interval '1 second' WHERE plumber_id=$1 AND status='pending'",[plumber.id]);await releasePendingBonuses(pool,plumber.id);add('release_boundary',{expectedAvailable:'400',actual:await balance(),note:'clock boundary simulated by SQL; 14-day waiting not elapsed in reality'});
 await pool.query("INSERT INTO app_rewards(id,title,description,cost_minor,availability_count,created_by) VALUES ('audit-reward','Тестовая награда','Тестовые данные аудита',300,3,$1)",[actor]);
 const race=await Promise.allSettled([redeemReward(pool,sessions.plumber.user.id,'audit-reward','audit-red-1'),redeemReward(pool,sessions.plumber.user.id,'audit-reward','audit-red-2')]);add('redemption_race',{statuses:race.map(x=>x.status),expectedAvailable:'100',actual:await balance()});
 const won:any=race.find(x=>x.status==='fulfilled');const rid=won.value.id;await processRewardRedemption(pool,actor,rid,'cancelled');await processRewardRedemption(pool,actor,rid,'cancelled');add('cancel_reward_twice',{expectedAvailable:'400',actual:await balance()});
 await pool.query("INSERT INTO app_loyalty_exclusions(id,scope_type,scope_value,reason,created_by) VALUES ('audit-exclude','product','audit-excluded','Audit',$1)",[actor]);
 for(const amount of ['0','1','99','100']){
  const tiny={...receipt,externalReceiptId:'audit-tiny-'+amount,totalMinor:amount,items:[{externalLineId:'tiny',productId:'audit-tiny',productName:'Tiny',quantityMilli:'1000',unitPriceMinor:amount,lineTotalMinor:amount}]};const b=await balance();await ingestReceipt(pool,tiny,actor);const a=await balance();add('tiny_'+amount,{purchaseMinor:amount,expectedDelta:amount==='100'?'1':'0',actualDelta:String(BigInt(a.pendingMinor)-BigInt(b.pendingMinor))});
 }
 const excluded={...receipt,externalReceiptId:'audit-excluded',totalMinor:'10000',items:[{externalLineId:'excluded',productId:'audit-excluded',productName:'Excluded',quantityMilli:'1000',unitPriceMinor:'10000',lineTotalMinor:'10000'}]};const b=await balance();await ingestReceipt(pool,excluded,actor);add('excluded',{expectedDelta:'0',actualDelta:String(BigInt((await balance()).pendingMinor)-BigInt(b.pendingMinor))});
 const conf=await getLoyaltyConfig(pool);await updateLoyaltyConfiguration(pool,actor,{...conf,baseRateBps:0});const bz=await balance();await ingestReceipt(pool,{...receipt,externalReceiptId:'audit-base-zero',totalMinor:'10000',items:[{externalLineId:'z',productId:'z',productName:'Base zero test',quantityMilli:'1000',unitPriceMinor:'10000',lineTotalMinor:'10000'}]},actor);add('base_zero_level_floor',{baseRateBps:0,levelRateBps:100,actualPendingDelta:String(BigInt((await balance()).pendingMinor)-BigInt(bz.pendingMinor)),classification:'requirement question: max(base,level) retains 1%'});await updateLoyaltyConfiguration(pool,actor,conf);
 try{await ingestReturn(pool,{...ret,externalReturnId:'audit-return-before-receipt',externalReceiptId:'not-yet-arrived'},actor);add('return_before_receipt',{accepted:true});}catch(e:any){add('return_before_receipt',{status:e.statusCode,error:e.message,note:'no persistent retry queue at ingestion; integration replay policy required'});}
}
main().catch(e=>{add('harness_failure',{error:e.message});process.exitCode=1;}).finally(async()=>{writeFileSync('/private/tmp/audit-loyalty-extra.json',JSON.stringify(results,null,2));await pool.end();});
