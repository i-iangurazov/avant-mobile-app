import{spawn}from'node:child_process';import{writeFileSync,readFileSync,mkdirSync}from'node:fs';import{setTimeout as wait}from'node:timers/promises';
const out='/Users/ilias_iangurazov/Commercial/Avantehnik Mobile App/docs/production-readiness/2026-09-18-340b960/evidence';mkdirSync(out+'/screenshots',{recursive:true});
const sessions=JSON.parse(readFileSync('/private/tmp/audit-sessions.json'));const base='http://127.0.0.1:8089';const port=9350;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--remote-debugging-port='+port,'--user-data-dir=/private/tmp/audit-gallery-chrome','about:blank'],{stdio:'ignore'});
let targets;for(let n=0;n<60;n++){try{targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break;}catch{}await wait(250);}
const ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=1;const pending=new Map();let errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const send=(method,params={})=>new Promise(r=>{const n=id++;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});const ev=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.result?.value;
const click=async text=>ev(`Array.from(document.querySelectorAll('[role="button"],button')).find(x=>x.innerText.trim()===${JSON.stringify(text)})?.click()`);
const gallery=[];
async function capture(name,role,path,state='default'){
 const body=await ev('document.body.innerText');const fonts=await ev("document.fonts.check('16px ionicons')");
 const scroll=await ev(`(()=>{const a=Array.from(document.querySelectorAll('*')).filter(e=>e.scrollHeight>e.clientHeight+20&&e.clientHeight>150&&['auto','scroll'].includes(getComputedStyle(e).overflowY));return a.map(e=>({height:e.clientHeight,total:e.scrollHeight}));})()`);
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(out+'/screenshots/'+name+'.png',Buffer.from(shot.result.data,'base64'));
 let bottoms=[];if(scroll?.length){await ev(`Array.from(document.querySelectorAll('*')).filter(e=>e.scrollHeight>e.clientHeight+20&&e.clientHeight>150&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).forEach(e=>e.scrollTop=e.scrollHeight)`);await wait(300);const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(out+'/screenshots/'+name+'-bottom.png',Buffer.from(s.result.data,'base64'));bottoms.push(name+'-bottom.png');}
 gallery.push({name,role,path,state,platform:'WEB EXPORT + LOCAL API + MOCK catalog/Telegram',viewport:'390x844',screenshot:name+'.png',bottoms,body,fonts,errors:[...errors],scroll});errors=[];console.log(name);
}
async function nav(path){await send('Page.navigate',{url:base+path});await wait(path==='/maps'?5500:1100);await ev('document.fonts.ready.then(()=>true)');}
async function role(r){await nav('/welcome');await ev(`localStorage.removeItem('avantehnik.app-session.v1');localStorage.removeItem('avantehnik:cart:v1');${r==='guest'?'':`localStorage.setItem('avantehnik.app-session.v1',${JSON.stringify(JSON.stringify(sessions[r]))});`}`);}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await role('guest');
 for(const p of ['/welcome','/choice','/login','/register','/catalog','/category/all-products','/product/'+sessions.productId,'/cart','/orders','/profile','/maps','/image-search','/profile/about','/find-plumber','/plumber/apply','/admin']){await nav(p);await capture('guest-'+p.slice(1).replaceAll('/','-'),'guest',p);}
 await nav('/register');await click('Создать аккаунт');await capture('register-validation','guest','/register','invalid empty');
 await role('customer');
 for(const p of ['/profile','/profile/edit','/profile/telegram','/orders','/orders/'+sessions.orderId,'/find-plumber','/plumber/apply']){await nav(p);await capture('customer-'+p.slice(1).replaceAll('/','-'),'customer',p);}
 await nav('/product/'+sessions.productId);await click('В корзину');await wait(300);await nav('/cart');await capture('customer-cart-populated','customer','/cart');
 await nav('/checkout');await capture('customer-checkout-pickup','customer','/checkout');await nav('/checkout');await click('Доставка');await capture('customer-checkout-delivery','customer','/checkout','delivery');
 await role('plumber');
 for(const p of ['/plumber-home','/plumber/qr','/plumber/history','/plumber/rewards','/plumber/content','/plumber/reviews','/leads','/profile','/plumber/apply']){await nav(p);await capture('plumber-'+p.slice(1).replaceAll('/','-'),'plumber',p);}
 await role('admin');await nav('/admin');await capture('admin-overview','admin','/admin');
 for(const label of ['Анкеты','Заявки','Чеки','Правила']){await nav('/admin');await click(label);await wait(350);await capture('admin-'+({'Анкеты':'applications','Заявки':'leads','Чеки':'receipts','Правила':'rules'})[label],'admin','/admin',label);}
 await role('guest');await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await nav('/category/all-products');await capture('compact-category','guest','/category/all-products','320x568');
 await send('Emulation.setDeviceMetricsOverride',{width:430,height:932,deviceScaleFactor:1,mobile:true});await nav('/maps');await capture('large-map','guest','/maps','430x932');
}finally{writeFileSync(out+'/gallery.json',JSON.stringify(gallery,null,2));ws.close();chrome.kill('SIGTERM');}
