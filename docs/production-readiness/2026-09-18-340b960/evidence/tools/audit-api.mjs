import {writeFileSync,readFileSync} from 'node:fs';
const base='http://127.0.0.1:8788';const results=[];const sessions={};
async function req(path,method='GET',body,token,headers={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
function record(id,result){results.push({id,...result});console.log(JSON.stringify(results.at(-1)));}
async function register(role,phone,extra={}){const r=await req('/auth/register','POST',{name:'Audit '+role,phone,password:'AuditOnly12345',...extra});if(r.status!==201)throw Error(JSON.stringify(r));sessions[role]={...r.body.session,user:r.body.user};return sessions[role];}
const admin=await register('admin','+996700000091');
record('admin_self_registration',{status:201,isAdmin:admin.user.isAdmin,adminEndpointStatus:(await req('/admin/program','GET',null,admin.accessToken)).status,expected:403});
const attacker=await register('attacker','+996700000093');
const patched=await req('/profile','PATCH',{name:'Audit attacker',phone:'+996700000092'},attacker.accessToken);
record('admin_via_profile_phone',{status:patched.status,isAdmin:patched.body.user?.isAdmin,adminEndpointStatus:(await req('/admin/program','GET',null,attacker.accessToken)).status,expected:403});
const customer=await register('customer','+996700000094');
record('ordinary_admin_denied',{status:(await req('/admin/program','GET',null,customer.accessToken)).status,expected:403});
const plumber=await register('plumber','+996700000095',{accountType:'plumber',plumberApplication:{fullName:'Audit plumber',city:'Бишкек',workingDistricts:['Октябрьский'],specializations:['Монтаж сантехники'],experienceYears:8,programConsent:true,dataProcessingConsent:true}});
record('pending_denied',{status:(await req('/plumber/dashboard','GET',null,plumber.accessToken)).status,expected:403});
record('approve_plumber',{status:(await req('/admin/plumbers/'+plumber.user.plumber.id+'/status','PATCH',{status:'approved'},admin.accessToken)).status});
sessions.plumber.user=(await req('/profile','GET',null,plumber.accessToken)).body.user;
const product=JSON.parse(readFileSync('/private/tmp/audit-real-products.json')).items[0];
const payload={clientRequestId:'audit_order_0001',customerName:'Audit customer',customerPhone:customer.user.phone,deliveryMethod:'pickup',storeId:'not-a-real-store',storeName:'Imaginary store',items:[{productId:product.id,productName:'Audit item',quantity:999,unitPrice:0.01}]};
const order=await req('/orders','POST',payload,customer.accessToken);const oid=order.body.data?.id;
record('untrusted_order_price_stock_store',{status:order.status,total:order.body.data?.total_amount,store:order.body.data?.store,quantity:order.body.data?.order_items?.[0]?.quantity,expected:'server quote, validated stock/store'});
record('order_same_retry',{status:(await req('/orders','POST',payload,customer.accessToken)).status});
const changed=await req('/orders','POST',{...payload,items:[{...payload.items[0],quantity:1,unitPrice:999}]},customer.accessToken);
record('order_changed_retry',{status:changed.status,total:changed.body.data?.total_amount,expected:409});
record('order_isolation',{status:(await req('/orders/'+oid,'GET',null,plumber.accessToken)).status,expected:404});
const races=await Promise.all(Array.from({length:4},()=>req('/orders','POST',{...payload,clientRequestId:'audit_race_0001'},customer.accessToken)));
record('concurrent_order_retry',{statuses:races.map(x=>x.status),errors:races.filter(x=>x.status>=400).map(x=>x.body.error),uniqueOrders:new Set(races.map(x=>x.body.data?.id).filter(Boolean)).size});
record('catalog_write_denied',{status:(await req('/products','POST',{name:'test'},customer.accessToken)).status,expected:405});
record('delete_account_absent',{status:(await req('/profile','DELETE',null,customer.accessToken)).status,expected:'working deletion route'});
const login=await req('/auth/login','POST',{phone:customer.user.phone,password:'AuditOnly12345'});record('login',{status:login.status,matchingUser:login.body.user?.id===customer.user.id});
const invalid=[];for(let i=0;i<16;i++)invalid.push((await req('/auth/login','POST',{phone:'+996700000000',password:'invalid'})).status);
record('rate_limit_spoof',{normal:invalid,spoofed:(await req('/auth/login','POST',{phone:'+996700000000',password:'invalid'},null,{'X-Forwarded-For':'192.0.2.123'})).status,expected:429});
writeFileSync('/private/tmp/audit-sessions.json',JSON.stringify({...sessions,orderId:oid,productId:product.id}));writeFileSync('/private/tmp/audit-api-results.json',JSON.stringify(results,null,2));
