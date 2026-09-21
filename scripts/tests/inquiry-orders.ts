import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createPool, ensureSchema } from '../server/db';
import { assertTestDatabase } from './fixtures';
import { registerCustomer } from '../server/auth';
import { trustedOrder } from '../server/order-trust';
import { createAppOrder, getAppOrder, updateAppOrderStatus, type NewOrder } from '../server/orders';
import { formatTelegramOrder } from '../server/telegram';
import { adaptOrderDetail } from '../../src/lib/bazaar/adapters';

async function main() {
 const pool=createPool(process.env.TEST_DATABASE_URL||'')!;assertTestDatabase(pool);
 const branch='inquiry-'+randomUUID(), org='inquiry-fixture';let customerId='';
 const checks:string[]=[];
 try {
  await ensureSchema(pool);
  const user=await registerCustomer(pool,{name:'Isolated inquiry',phone:'+996790'+String(Date.now()).slice(-6),password:'test-password'},'inquiry-fixture-secret');customerId=user.user.id;
  await pool.query('INSERT INTO app_order_branches(organization_id,id,name,address,is_active,orders_enabled,delivery_enabled) VALUES($1,$2,\'QA branch\',\'QA address\',true,true,true)',[org,branch]);
  const variant=(await pool.query('SELECT v.id FROM "Variant" v JOIN "Product" p ON p.id=v."productId" JOIN "Category" c ON c.id=p."categoryId" WHERE v."isActive" AND p."isActive" AND c."isActive" AND p."subcategoryId" IS NULL LIMIT 1')).rows[0];assert.ok(variant);
  const context={organizationId:org,catalogSource:'database',fulfilmentMode:'inquiry' as const,deliveryBranchId:branch};
  const payload:NewOrder={clientRequestId:randomUUID(),customerName:'QA',customerPhone:user.user.phone,deliveryMethod:'pickup',storeId:branch,storeName:'forged',storeAddress:'forged',deliveryAddress:null,comment:null,items:[{productId:variant.id,productName:'forged',quantity:2,unitPrice:0.01,unitPriceLabel:null}]};
  const quote=await trustedOrder(pool,payload,context,false);assert.notEqual(quote.items[0].unitPrice,0.01);assert.equal(quote.storeName,'QA branch');
  assert.equal(Number((await pool.query('SELECT count(*) n FROM app_order_offers WHERE organization_id=$1',[org])).rows[0].n),0);
  await assert.rejects(()=>createAppOrder(pool,customerId,payload,context),/Цена изменилась/);
  checks.push('no inventory rows needed; server checks current catalogue price and branch; tampered price rejected');
  for(const quantity of [-1,0,1.5,1000])await assert.rejects(()=>trustedOrder(pool,{...payload,items:[{...payload.items[0],quantity}]},context,false));
  for(const productId of ['missing-variant',null])await assert.rejects(()=>trustedOrder(pool,{...payload,items:[{...payload.items[0],productId}]},context,false));
  await assert.rejects(()=>trustedOrder(pool,{...payload,items:[...payload.items,...payload.items]},context,false));
  await assert.rejects(()=>trustedOrder(pool,payload,{...context,organizationId:'foreign'},false));
  await assert.rejects(()=>trustedOrder(pool,{...payload,storeId:'foreign'},context,false));
  await assert.rejects(()=>trustedOrder(pool,payload,{...context,catalogSource:'bazaar'},false));
  checks.push('negative/fractional/excess quantity, duplicate/missing product, foreign organization/branch and legacy source rejected');
  const client=await pool.connect();try{
   await client.query('BEGIN');await client.query('UPDATE "Variant" SET "isActive"=false WHERE id=$1',[variant.id]);
   await assert.rejects(()=>trustedOrder(client,payload,context,false),/недоступен/);
   await client.query('ROLLBACK');
   await client.query('BEGIN');await client.query('UPDATE "Variant" SET "priceRetail"=$2 WHERE id=$1',[variant.id,Number(quote.items[0].unitPrice)+1]);
   await assert.rejects(()=>trustedOrder(client,{...payload,items:quote.items},context,true),/Цена изменилась/);
   await client.query('ROLLBACK');
  }finally{client.release();}
  checks.push('inactive variant and price change after quote rejected; catalogue mutations rolled back');
  const valid={...payload,items:quote.items};
  const results=await Promise.all(Array.from({length:20},()=>createAppOrder(pool,customerId,valid,context)));
  assert.equal(results.filter(r=>r.created).length,1);assert.equal(new Set(results.map(r=>r.order!.id)).size,1);
  const order=results[0].order!;assert.equal(order.fulfilment_mode,'inquiry');assert.match(order.availability_notice!,/WhatsApp/);assert.match(formatTelegramOrder(order),/не резервирует/);
  assert.equal(adaptOrderDetail(order).availability_notice,order.availability_notice);
  assert.equal((await pool.query('SELECT inventory_held FROM app_orders WHERE id=$1',[order.id])).rows[0].inventory_held,false);
  await assert.rejects(()=>createAppOrder(pool,customerId,{...valid,comment:'different'},context),/другим содержимым/);
  assert.equal((await createAppOrder(pool,customerId,valid,context)).created,false);
  await updateAppOrderStatus(pool,order.id,'cancelled');
  assert.equal((await getAppOrder(pool,order.id,customerId))!.status,'cancelled');
  assert.equal(Number((await pool.query('SELECT count(*) n FROM app_order_offers WHERE organization_id=$1',[org])).rows[0].n),0);
  checks.push('20 parallel retries persist exactly one order; mode survives history; Telegram explains conditional availability; cancellation never changes stock');
  const result={status:'PASS',checks};writeFileSync('artifacts/device-20260921/inquiry-orders.json',JSON.stringify(result,null,2));console.log(result);
 }finally{
  if(customerId){await pool.query('DELETE FROM app_orders WHERE customer_id=$1',[customerId]);await pool.query('DELETE FROM app_customers WHERE id=$1',[customerId]);}
  await pool.query('DELETE FROM app_order_branches WHERE organization_id=$1 AND id=$2',[org,branch]);await pool.end();
 }
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
