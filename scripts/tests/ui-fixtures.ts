import {writeFileSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createPool,ensureSchema} from '../server/db';
import {registerFixture,assertTestDatabase} from './fixtures';
import {getCustomerProfile} from '../server/auth';
import {createAppOrder} from '../server/orders';
import {createManualAdjustment} from '../server/loyalty';
const pool=createPool(process.env.TEST_DATABASE_URL || '')!;const secret='remediation-local-secret-not-production';
async function main(){try{assertTestDatabase(pool);await ensureSchema(pool);
 const suffix=String(Date.now()).slice(-6);const sessions:Record<string,unknown>={};
 for(const [i,role] of ['customer','plumber','admin','erase'].entries()){
  const result=await registerFixture(pool,{name:`Тестовый ${role}`,phone:`+99671${i}${suffix}`,address:'Тестовый адрес, Бишкек',password:'test-password',accountType:role==='plumber'?'plumber':'customer',plumberApplication:role==='plumber'?{fullName:'Тестовый мастер',city:'Бишкек',workingDistricts:['Октябрьский'],specializations:['Монтаж'],experienceYears:5,programConsent:true,dataProcessingConsent:true}:undefined},secret);
  if(role==='admin')await pool.query("INSERT INTO app_account_roles(account_id,role) VALUES($1,'admin')",[result.user.id]);
  if(role==='plumber'){
   await pool.query("UPDATE app_plumber_profiles SET application_status='approved' WHERE account_id=$1",[result.user.id]);
   for(let n=0;n<137;n++)await createManualAdjustment(pool,result.user.id,result.user.plumber!.id,100,`Тестовая операция ${n+1}`);
  }
  sessions[role]={...result.session,user:(await getCustomerProfile(pool,result.user.id)).user};
 }
 const snapshot=JSON.parse(readFileSync('docs/production-readiness/2026-09-18-340b960/evidence/catalog-snapshot.json','utf8'));const products=snapshot.items;
 const product=products.find((p:any)=>Number(p.stockQty||p.pcs||p.quantity||p.stock||0)>0)||products[0];sessions.productId=product.id;
 for(let i=1;i<=6;i++){
  await pool.query("INSERT INTO app_order_branches(organization_id,id,name,address,is_active,orders_enabled,delivery_enabled) VALUES('fixture-org',$1,$2,'Тестовый адрес',true,true,true) ON CONFLICT(organization_id,id) DO UPDATE SET is_active=true",[`store-${i}`,`Тестовый филиал ${i}`]);
  for(const p of products)await pool.query("INSERT INTO app_order_offers(organization_id,branch_id,product_id,product_name,unit_price_minor,stock_quantity,is_active,valid_until) VALUES('fixture-org',$1,$2,$3,12345,10000,true,now()+interval '1 day') ON CONFLICT(organization_id,branch_id,product_id) DO UPDATE SET stock_quantity=10000,valid_until=EXCLUDED.valid_until",[`store-${i}`,p.id,p.name]);
 }
 const customer=(sessions.customer as any).user;
 const order=await createAppOrder(pool,customer.id,{clientRequestId:randomUUID(),customerName:customer.name,customerPhone:customer.phone,deliveryMethod:'pickup',storeId:'store-1',storeName:null,storeAddress:null,deliveryAddress:null,comment:'Изолированная проверка',items:[{productId:product.id,productName:product.name,quantity:1,unitPrice:123.45,unitPriceLabel:null}]},{organizationId:'fixture-org'});
 sessions.orderId=order.order!.id;
 writeFileSync('/private/tmp/avantehnik-remediation-sessions.json',JSON.stringify(sessions,null,2),{mode:0o600});
 console.log('Created isolated customer, approved plumber with 137 ledger operations, database-granted administrator and trusted order fixtures.');
}finally{await pool.end();}}
void main().catch(e=>{console.error(e);process.exitCode=1;});
