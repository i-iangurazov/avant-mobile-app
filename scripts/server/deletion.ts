import type {MediaProvider} from "./media";
import type pg from 'pg';
import {consumePhoneProof,fail,type PhoneProof} from './security';
import {verifyPassword} from './auth';

export async function deleteAccount(pool:pg.Pool,accountId:string,password:string,proof:PhoneProof,secret:string,
 policy:{mode:string;version:string},media?:MediaProvider) {
 if(policy.mode!=='erase-all' || !policy.version) fail('Удаление ещё не настроено: обратитесь в поддержку. Аккаунт пока не удалён.',503);
 const account=(await pool.query('SELECT phone,password_hash FROM app_customers WHERE id=$1',[accountId])).rows[0];
 if(!account || !verifyPassword(password,account.password_hash)) fail('Неверный пароль.',401);
 await consumePhoneProof(pool,secret,'delete',account.phone,accountId,proof);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT id FROM app_customers WHERE id=$1 FOR UPDATE',[accountId]);
  const plumbers=(await client.query<{id:string}>('SELECT id FROM app_plumber_profiles WHERE account_id=$1 FOR UPDATE',[accountId])).rows.map(x=>x.id);
  const orders=(await client.query('SELECT id,organization_id,store_id,inventory_held FROM app_orders WHERE customer_id=$1 ORDER BY id FOR UPDATE',[accountId])).rows;
  // Remove this account's holds, not another customer's inventory or balances.
  for(const order of orders.filter(o=>o.inventory_held)) {
   const items=(await client.query('SELECT product_id,quantity FROM app_order_items WHERE order_id=$1 ORDER BY product_id',[order.id])).rows;
   for(const item of items)await client.query('UPDATE app_order_offers SET reserved_quantity=reserved_quantity-$4 WHERE organization_id=$1 AND branch_id=$2 AND product_id=$3',[order.organization_id,order.store_id,item.product_id,item.quantity]);
  }
  const requests=(await client.query<{id:string}>('SELECT id FROM app_service_requests WHERE customer_id=$1',[accountId])).rows.map(x=>x.id);
  await client.query('DELETE FROM app_plumber_reviews WHERE customer_id=$1 OR plumber_id=ANY($2::text[])',[accountId,plumbers]);
  await client.query('DELETE FROM app_service_requests WHERE customer_id=$1',[accountId]);
  await client.query("UPDATE app_service_requests SET assigned_plumber_id=NULL,assigned_by=NULL,assigned_at=NULL,status=CASE WHEN status IN ('accepted','in_progress','viewed') THEN 'new' ELSE status END WHERE assigned_plumber_id=ANY($1::text[])",[plumbers]);
  await client.query('DELETE FROM app_loyalty_transactions WHERE plumber_id=ANY($1::text[])',[plumbers]);
  await client.query('DELETE FROM app_loyalty_returns WHERE receipt_id IN (SELECT id FROM app_loyalty_receipts WHERE plumber_id=ANY($1::text[]))',[plumbers]);
  await client.query('DELETE FROM app_loyalty_receipts WHERE plumber_id=ANY($1::text[])',[plumbers]);
  await client.query(`UPDATE app_rewards r SET availability_count=availability_count+x.count FROM (SELECT reward_id,COUNT(*)::int count FROM app_reward_redemptions WHERE plumber_id=ANY($1::text[]) AND status IN ('pending','approved') GROUP BY reward_id) x WHERE r.id=x.reward_id AND r.availability_count IS NOT NULL`,[plumbers]);
  await client.query('DELETE FROM app_reward_redemptions WHERE plumber_id=ANY($1::text[])',[plumbers]);
  await client.query('DELETE FROM app_orders WHERE customer_id=$1',[accountId]);
  const entities=[accountId,...plumbers,...requests,...orders.map(o=>o.id)];
  await client.query('DELETE FROM app_admin_audit_log WHERE actor_id=$1 OR entity_id=ANY($2::text[])',[accountId,entities]);
  await client.query('DELETE FROM app_notification_outbox WHERE recipient_account_id=$1 OR EXISTS(SELECT 1 FROM unnest($2::text[]) entity WHERE position(entity in dedupe_key)>0)',[accountId,entities]);
  await client.query('DELETE FROM app_phone_challenges WHERE phone=$1',[account.phone]);
  const assets=(await client.query('SELECT provider_id FROM app_uploaded_media WHERE account_id=$1',[accountId])).rows;
  if(assets.length && !media)fail('Удаление фотографий ещё не подключено.',503);
  for(const asset of assets)await media!.remove(asset.provider_id);
  await client.query('DELETE FROM app_customers WHERE id=$1',[accountId]);
  await client.query('COMMIT');
  return {deleted:true,policyVersion:policy.version};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
