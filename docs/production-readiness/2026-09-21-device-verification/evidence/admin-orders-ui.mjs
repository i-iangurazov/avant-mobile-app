import assert from 'node:assert/strict';
import{spawn}from'node:child_process';import{writeFileSync,readFileSync,mkdirSync}from'node:fs';import{setTimeout as wait}from'node:timers/promises';import pg from 'pg';
if(process.env.TEST_DATABASE_URL!=='postgresql://audit@127.0.0.1:55448/remediation')throw Error('Isolated database only');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});const sessions=JSON.parse(readFileSync('/private/tmp/avantehnik-remediation-sessions.json'));
const out=process.env.REGRESSION_EVIDENCE_DIR || process.cwd()+'/artifacts/device-20260921/web';mkdirSync(out+'/screenshots',{recursive:true});const checks=[],errors=[];const base='http://127.0.0.1:8096',port=9376;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir=/private/tmp/avantehnik-admin-orders-chrome','about:blank'],{stdio:'ignore'});
let targets;for(let n=0;n<60;n++){try{targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break;}catch{}await wait(250);}
const ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=1;const pending=new Map();let loseResponse=false,lostResponse=false;
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=id++;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Fetch.requestPaused'){const p=m.params;if(loseResponse&&p.request.method==='POST'&&p.responseStatusCode===201){loseResponse=false;lostResponse=true;void send('Fetch.failRequest',{requestId:p.requestId,errorReason:'ConnectionClosed'});}else void send('Fetch.continueRequest',{requestId:p.requestId});}});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result.exceptionDetails)throw Error(r.result.exceptionDetails.text);return r.result.result.value;};
const body=()=>ev('document.body.innerText');
const until=async(fn,label)=>{for(let n=0;n<60;n++){if(await fn())return;await wait(200);}throw Error('Timeout: '+label+'\n'+await body());};
const click=async text=>{const found=await ev(`(()=>{const x=Array.from(document.querySelectorAll('[role="button"],button,[role="radio"]')).find(x=>x.innerText.trim()===${JSON.stringify(text)});if(!x)return false;x.click();return true;})()`);assert.ok(found,'Control '+text);await wait(250);};
const nav=async path=>{await send('Page.navigate',{url:base+path});await wait(1000);};
const role=async r=>{await nav('/welcome');await ev(`localStorage.clear();localStorage.setItem('avantehnik.app-session.v1',${JSON.stringify(JSON.stringify(sessions[r]))})`);};
const shot=async name=>{await ev('document.fonts.ready');const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(out+'/screenshots/'+name+'.png',Buffer.from(r.result.data,'base64'));};
const record=(name,value=true)=>{assert.ok(value,name);checks.push({name,status:'PASS'});console.log(name);};
const fill=async(label,value)=>{const ok=await ev(`(()=>{const x=Array.from(document.querySelectorAll('input,textarea')).find(x=>x.getAttribute('aria-label')===${JSON.stringify(label)}||x.placeholder===${JSON.stringify(label)});if(!x)return false;const p=x.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(x,${JSON.stringify(value)});x.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);assert.ok(ok,'Input '+label);await wait(200);};
try {
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await role('customer');await nav('/admin/orders');await until(async()=> (await body()).includes('Нет доступа'),'ordinary account denied');record('customer UI cannot read admin orders');
 await role('admin');await nav('/admin');await until(async()=> (await body()).includes('Заказы покупателей'),'admin overview');await click('Заказы покупателей');await until(async()=> (await body()).includes('AV-'),'admin list');record('admin overview opens actual customer order list');await shot('admin-orders-list');
 record('Telegram delivery is visible',(await body()).includes('Telegram:'));
 await ev(`Array.from(document.querySelectorAll('[role="button"]')).find(x=>x.innerText.includes('AV-')).click()`);await until(async()=> (await body()).includes('История статусов'),'admin detail');await shot('admin-order-detail');
 const id=decodeURIComponent((await ev('location.pathname')).split('/').at(-1));const row=(await pool.query('SELECT id,customer_phone,total_amount FROM app_orders WHERE id=$1',[id])).rows[0];
 record('detail displays persisted customer contact',row && (await body()).includes(row.customer_phone));
 record('detail displays trusted total',(await body()).includes(Number(row.total_amount).toLocaleString('ru-RU')));
 await click('Обновить статус');await until(async()=> (await body()).includes('История статусов'),'refresh');record('manual refresh retains same order',(await ev('location.pathname')).endsWith(id));
 await role('customer');await nav('/admin/orders/'+id);await until(async()=> (await body()).includes('Доступно только администратору'),'account switch');record('account switch removes administrator order details',!(await body()).includes(row.customer_phone));
 await nav('/welcome');await ev('localStorage.clear()');await nav('/admin/orders');await until(async()=> (await body()).includes('Войдите как администратор'),'guest');record('guest gets login path');await shot('admin-orders-guest');
 record('No JavaScript exceptions',errors.length===0);writeFileSync(out+'/admin-orders.json',JSON.stringify({status:'PASS',platform:'Chrome390x844 exported app, isolated backend',checks,errors},null,2));
} catch(error) {writeFileSync(out+'/admin-orders-failed.json',JSON.stringify({error:String(error),body:await body().catch(()=>''),checks,errors},null,2));throw error;}
finally {ws.close();chrome.kill('SIGTERM');await pool.end();}
