import assert from 'node:assert/strict';
import{spawn}from'node:child_process';import{writeFileSync,readFileSync,mkdirSync}from'node:fs';import{setTimeout as wait}from'node:timers/promises';import pg from 'pg';
if(process.env.TEST_DATABASE_URL!=='postgresql://audit@127.0.0.1:55448/remediation')throw Error('Isolated database only');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});const sessions=JSON.parse(readFileSync('/private/tmp/avantehnik-remediation-sessions.json'));
const out=process.env.REGRESSION_EVIDENCE_DIR || process.cwd()+'/artifacts/device-20260921/web';mkdirSync(out+'/screenshots',{recursive:true});const checks=[],errors=[];const base='http://127.0.0.1:8096',port=9361;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir=/private/tmp/remediation-flows-chrome','about:blank'],{stdio:'ignore'});
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
try{
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const phone='+996709'+String(Date.now()).slice(-6);
 const response=await fetch('http://127.0.0.1:8789/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Recovery UI fixture',phone,password:'test-password'})});assert.equal(response.status,201);const account=await response.json();
 await nav('/welcome');await ev('localStorage.clear()');await nav('/password-reset');
 await fill('Телефон аккаунта',phone);await fill('Как с вами связаться','Isolated QA support contact');await click('Отправить заявку');
 await until(async()=>(await body()).includes('заявка передана в поддержку'),'recovery request');record('Recovery request submitted through guest UI without SMS');await shot('recovery-requested');
 await role('admin');await nav('/admin');await until(async()=>(await body()).includes('Восстановление аккаунтов'),'admin overview');await click('Восстановление аккаунтов');await until(async()=>(await body()).includes(phone),'queue contains request');
 await shot('recovery-admin-queue');
 assert.ok(await ev(`(()=>{const b=Array.from(document.querySelectorAll('[role=button]')).find(x=>x.innerText==='Проверить владельца'&&x.parentElement.innerText.includes(${JSON.stringify(phone)}));if(!b)return false;b.click();return true})()`));
 await fill('Основание и результат проверки','Isolated fixture review, no real identity approval');await fill('Текущий пароль администратора','test-password');await click('Выдать одноразовую ссылку');
 await until(async()=>(await body()).includes('avantehnik://password-reset?token='),'issued link');
 const link=(await body()).match(/avantehnik:\/\/password-reset\?token=[A-Za-z0-9_-]{43}/)[0];record('Administrator UI issues one-time recovery link after password and review note');
 await nav('/welcome');await ev('localStorage.clear()');await nav('/password-reset');await click('У меня есть ссылка восстановления');await fill('Ссылка восстановления',link);await fill('Новый пароль','new-ui-password');await click('Изменить пароль');await until(async()=>(await ev('location.pathname'))==='/login','reset completed');record('Pasted link resets password and opens login');await shot('recovery-completed-login');
 await fill('Телефон',phone);await fill('Пароль','new-ui-password');await click('Войти');await until(async()=>(await ev('location.pathname'))==='/catalog','new password login');record('New password signs in through actual UI');
 const old=await fetch('http://127.0.0.1:8789/profile',{headers:{Authorization:'Bearer '+account.session.accessToken}});record('Reset invalidates pre-reset access session',old.status===401);
 record('No runtime exceptions in manual recovery flow',errors.length===0);writeFileSync(out+'/recovery-ui.json',JSON.stringify({status:'PASS',scope:'web + isolated DB; staff identity check simulated, not operational approval',checks,errors},null,2));
}catch(error){writeFileSync(out+'/recovery-ui-failed.json',JSON.stringify({status:'FAIL',error:String(error),checks,errors},null,2));throw error;}finally{ws.close();chrome.kill('SIGTERM');await pool.end();}
