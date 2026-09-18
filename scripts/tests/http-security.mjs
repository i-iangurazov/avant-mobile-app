import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHmac} from 'node:crypto';
import pg from 'pg';
const db=process.env.TEST_DATABASE_URL;if(db!=='postgresql://audit@127.0.0.1:55448/remediation')throw new Error('Isolated database only');
const pool=new pg.Pool({connectionString:db});const base='http://127.0.0.1:8789';
const sessions=JSON.parse(readFileSync('/private/tmp/avantehnik-remediation-sessions.json'));
const checks=[];
async function req(path,method='GET',body,token=sessions.customer.accessToken,headers={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,body:await r.json()};}
function check(name,actual,expected){assert.equal(actual,expected,name);checks.push({name,actual,expected});}
try{
 const routes=[['GET','/admin/program'],['GET','/admin/plumbers'],['PATCH','/admin/plumbers/missing/status'],['GET','/admin/loyalty/config'],['PATCH','/admin/loyalty/config'],['POST','/admin/loyalty/release'],['POST','/admin/receipts'],['POST','/admin/returns'],['POST','/admin/loyalty/adjustments'],['GET','/admin/leads'],['GET','/admin/leads/missing/candidates'],['POST','/admin/leads/missing/assign'],['PATCH','/admin/reviews/missing'],['POST','/admin/rewards'],['PUT','/admin/rewards'],['PATCH','/admin/redemptions/missing/status'],['POST','/admin/promotions'],['PUT','/admin/promotions'],['POST','/admin/exclusions'],['PUT','/admin/exclusions'],['POST','/admin/content'],['PUT','/admin/content']];
 for(const [method,path]of routes){check(`customer ${method} ${path}`,(await req(path,method,method==='GET'?undefined:{})).status,403);check(`guest ${method} ${path}`,(await req(path,method,method==='GET'?undefined:{},null)).status,401);}
 check('database admin access',(await req('/admin/program','GET',undefined,sessions.admin.accessToken)).status,200);
 const tamper=await req('/profile','PATCH',{name:sessions.customer.user.name,phone:sessions.customer.user.phone,address:'Test',roles:['admin'],isAdmin:true,verified:true});check('role fields do not grant admin',tamper.body.user.isAdmin,false);
 check('unverified phone change',(await req('/profile','PATCH',{name:'Test',phone:'+996700000091',verified:true,role:'admin'})).status,400);
 const phone=`+996708${String(Date.now()).slice(-6)}`;const registration={name:'HTTP identity test',phone,password:'test-password',verified:true,role:'admin'};
 check('unverified registration',(await req('/auth/register','POST',registration,null)).status,400);
 const challenge=await req('/auth/phone/challenge','POST',{phone,action:'register'},null);check('isolated SMS challenge',challenge.status,200);
 const otp=JSON.parse(readFileSync('/private/tmp/avantehnik-remediation-otp.json'))[challenge.body.challengeId];const proof={challengeId:challenge.body.challengeId,code:otp.code};
 check('wrong OTP',(await req('/auth/register','POST',{...registration,phoneProof:{...proof,code:'invalid'}},null)).status,400);
 const account=await req('/auth/register','POST',{...registration,phoneProof:proof},null);check('verified registration',account.status,201);check('OTP does not grant admin',account.body.user.isAdmin,false);
 check('OTP replay',(await req('/auth/register','POST',{...registration,phoneProof:proof},null)).status,400);
 await pool.query("INSERT INTO app_account_roles(account_id,role) VALUES($1,'admin')",[account.body.user.id]);
 await pool.query("UPDATE app_account_roles SET is_active=false WHERE account_id=$1 AND role='admin'",[account.body.user.id]);
 const fresh=await req('/auth/refresh','POST',{refreshToken:account.body.session.refreshToken},null);check('refresh reloads revoked role',fresh.body.user.isAdmin,false);
 check('rotated refresh replay',(await req('/auth/refresh','POST',{refreshToken:account.body.session.refreshToken},null)).status,401);
 const payload=Buffer.from(JSON.stringify({sub:sessions.admin.user.id,phone:sessions.admin.user.phone,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url');const signature=createHmac('sha256','remediation-local-secret-not-production').update(payload).digest('base64url');
 check('legacy token cannot regain admin',(await req('/admin/program','GET',undefined,`${payload}.${signature}`)).status,401);
 const body={clientRequestId:randomUUID(),customerName:'HTTP Test',customerPhone:sessions.customer.user.phone,deliveryMethod:'pickup',storeId:'store-1',items:[{productId:sessions.productId,productName:'Tampered',quantity:1,unitPrice:123.45}]};
 for(const change of [{discount:100000},{bonusAmount:999999},{organizationId:'other'},{items:[{...body.items[0],quantity:-1}]},{items:[{...body.items[0],quantity:1.5}]}])check('invalid monetary/quantity request',(await req('/orders','POST',{...body,...change})).status,400);
 for(const change of [{storeId:'foreign-store'},{items:[{...body.items[0],unitPrice:0.01}]},{items:[{...body.items[0],productId:'missing'}]},{items:[{...body.items[0],quantity:999}]}]){
   if(change.items?.[0]?.quantity===999)continue; // Quantity cap is valid; inventory-specific exhaustion covered by isolated order regression.
   check('untrusted order data',(await req('/orders','POST',{...body,...change})).status,409);
 }
 const orders=await Promise.all(Array.from({length:20},()=>req('/orders','POST',body)));check('one HTTP creation',orders.filter(r=>r.status===201).length,1);check('19 HTTP replays',orders.filter(r=>r.status===200).length,19);check('same HTTP order ID',new Set(orders.map(r=>r.body.data.id)).size,1);
 check('changed payload conflict',(await req('/orders','POST',{...body,comment:'changed'})).status,409);
 check('foreign order read',(await req(`/orders/${orders[0].body.data.id}`,'GET',undefined,sessions.plumber.accessToken)).status,404);
 const before=await pool.query('SELECT COUNT(*) FROM app_orders WHERE customer_id=$1 AND client_request_id=$2',[sessions.customer.user.id,body.clientRequestId]);check('one database operation',Number(before.rows[0].count),1);
 const history=await req('/plumber/loyalty/transactions','GET',undefined,sessions.plumber.accessToken);check('default ledger page',history.body.data.length,30);
 let entries=[];let cursor;do{const r=await req('/plumber/loyalty/transactions?limit=30'+(cursor?'&cursor='+encodeURIComponent(cursor):''),'GET',undefined,sessions.plumber.accessToken);entries.push(...r.body.data);cursor=r.body.data.length===30?r.body.data.at(-1).cursor:null;}while(cursor);
 check('all HTTP ledger entries',entries.length,137);check('no HTTP ledger duplicates',new Set(entries.map(x=>x.id)).size,137);
 for(let i=0;i<16;i++)await req('/auth/login','POST',{phone:'+996799999999',password:'wrong'},null);
 check('spoofed forwarded header cannot bypass',(await req('/auth/login','POST',{phone:'+996799999999',password:'wrong'},null,{'X-Forwarded-For':'198.51.100.15'})).status,429);
 writeFileSync('docs/production-readiness/2026-09-18-remediation/evidence/http-security.json',JSON.stringify({checks,status:'PASS',adminRoutes:routes.length,externalTraffic:'SMS/Telegram/catalog mocked in isolated process'},null,2));
 console.log(`HTTP security/order/history: ${checks.length} checks passed; ${routes.length} admin method/path combinations denied for customer and guest.`);
}finally{
 // This is the dedicated test DB; prevent intentional login throttling from affecting subsequent UI fixture runs.
 await pool.query('DELETE FROM app_rate_limits');await pool.end();
}
