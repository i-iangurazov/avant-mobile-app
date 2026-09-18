import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPool,ensureSchema} from '../server/db';
import {createAppOrder,getAppOrder,updateAppOrderStatus,type NewOrder} from '../server/orders';
import {trustedOrder,trustedTotal} from '../server/order-trust';
import {adaptOrder,adaptOrderDetail} from '../../src/lib/bazaar/adapters';
import {submitAttempt} from '../../src/lib/orders/checkoutAttempt';
const url=process.env.TEST_DATABASE_URL || '';
if(!/^postgres(?:ql)?:\/\/[^/]*@127\.0\.0\.1:55448\/remediation$/.test(url)) throw new Error('Isolated DB only');
const pool=createPool(url)!;let assertions=0;
const context={organizationId:`test-${randomUUID()}`}; const customer=randomUUID();
const body:NewOrder={clientRequestId:randomUUID(),customerName:'Test',customerPhone:'+996700000099',deliveryMethod:'pickup',storeId:'branch',storeName:'Forged',storeAddress:'Forged',deliveryAddress:null,comment:null,items:[{productId:'sku',productName:'Forged',quantity:2,unitPrice:12.35,unitPriceLabel:null}]};
async function rejects(fn:()=>Promise<unknown>,status:number){await assert.rejects(fn,(e:any)=>e.statusCode===status);assertions++;}
async function main(){try{
 await ensureSchema(pool);
 await pool.query("INSERT INTO app_customers(id,name,phone,password_hash) VALUES($1,'Test',$2,'not-a-login')",[customer,`test-${customer}`]);
 await pool.query("INSERT INTO app_order_branches(organization_id,id,name,address,is_active,orders_enabled) VALUES($1,'branch','Trusted branch','Trusted address',true,true)",[context.organizationId]);
 await pool.query("INSERT INTO app_order_offers(organization_id,branch_id,product_id,product_name,unit_price_minor,stock_quantity,is_active,valid_until) VALUES($1,'branch','sku','Trusted product',1235,20,true,now()+interval '1 hour')",[context.organizationId]);
 for(const qty of [-1,0,0.5,999]) await rejects(()=>createAppOrder(pool,customer,{...body,clientRequestId:randomUUID(),items:[{...body.items[0],quantity:qty}]},context),qty===999?409:400);
 await rejects(()=>createAppOrder(pool,customer,{...body,storeId:'foreign'},context),409);
 await rejects(()=>createAppOrder(pool,customer,body,{organizationId:'other-org'}),409);
 await rejects(()=>createAppOrder(pool,customer,{...body,items:[{...body.items[0],productId:'unknown'}]},context),409);
 await rejects(()=>createAppOrder(pool,customer,{...body,items:[{...body.items[0],unitPrice:0.01}]},context),409);
 const responses=await Promise.all(Array.from({length:20},()=>createAppOrder(pool,customer,body,context)));
 const ids=new Set(responses.map(x=>x.order!.id));assert.equal(ids.size,1);assert.equal(responses.filter(x=>x.created).length,1);assertions+=2;
 const order=responses[0].order!;assert.equal(order.total_amount,'24.70');assert.equal(order.store!.name,'Trusted branch');assert.equal(order.order_items[0].product_name,'Trusted product');assertions+=3;
 const adapted=adaptOrder({data:order});const detail=adaptOrderDetail({data:order});
 assert.equal(adapted.id,order.id);assert.equal(detail.id,order.id);assert.throws(()=>adaptOrder({data:{}}));assertions+=3;
 await rejects(()=>createAppOrder(pool,customer,{...body,items:[{...body.items[0],quantity:3}]},context),409);
 assert.equal(await getAppOrder(pool,order.id,'other-user'),null);assertions++;
 await pool.query("UPDATE app_order_offers SET unit_price_minor=2000 WHERE organization_id=$1",[context.organizationId]);
 assert.equal((await createAppOrder(pool,customer,body,context)).order!.id,order.id);assertions++;
 await rejects(()=>createAppOrder(pool,customer,{...body,clientRequestId:randomUUID()},context),409);
 const quote=await trustedOrder(pool,body,context,false);assert.equal(trustedTotal(quote.items),'40.00');assertions++;
 // Lost acknowledgement: transport committed then threw; persisted attempt survives a new call/body.
 const state=new Map<string,string>();const storage={getItem:async(k:string)=>state.get(k)||null,setItem:async(k:string,v:string)=>{state.set(k,v);},removeItem:async(k:string)=>{state.delete(k);}};
 let calls=0;let cleanup=0;const retryBody={...body,items:quote.items};
 const send=async(payload:NewOrder,key:string)=>{calls++;const result=await createAppOrder(pool,customer,{...payload,clientRequestId:key},context);if(calls===1)throw new Error('ACK lost after commit');return result.order!;};
 await assert.rejects(()=>submitAttempt(storage,customer,retryBody,send,async()=>{cleanup++;}));assertions++;
 const recovered=await submitAttempt(storage,customer,{...retryBody,comment:'user edited after timeout'},send,async()=>{cleanup++;});
 const count=await pool.query('SELECT COUNT(*) FROM app_orders WHERE customer_id=$1',[customer]);assert.equal(Number(count.rows[0].count),2);assert.equal(cleanup,1);assert.equal(recovered.comment,null);assertions+=3;
 // Concurrent separate orders cannot oversell the remaining stock.
 const parallel=await Promise.allSettled(Array.from({length:20},()=>createAppOrder(pool,customer,{...retryBody,clientRequestId:randomUUID(),items:[{...quote.items[0],quantity:2}]},context)));
 assert.equal(parallel.filter(x=>x.status==='fulfilled').length,8);assertions++;
 const stock=await pool.query('SELECT reserved_quantity FROM app_order_offers WHERE organization_id=$1',[context.organizationId]);assert.equal(stock.rows[0].reserved_quantity,20);assertions++;
 await updateAppOrderStatus(pool,order.id,'cancelled');await updateAppOrderStatus(pool,order.id,'cancelled');
 assert.equal((await pool.query('SELECT reserved_quantity FROM app_order_offers WHERE organization_id=$1',[context.organizationId])).rows[0].reserved_quantity,18);assertions++;
 console.log(JSON.stringify({suite:'orders',assertions,status:'PASS',parallelSameKey:20,lostAck:'one server operation',inventory:'isolated authoritative fixtures; real integration not verified'}));
}finally{await pool.end();}}
void main().catch(e=>{console.error(e);process.exitCode=1;});
