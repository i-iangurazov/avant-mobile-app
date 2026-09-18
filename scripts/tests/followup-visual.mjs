import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {setTimeout as wait} from 'node:timers/promises';
import assert from 'node:assert/strict';
const out='docs/production-readiness/2026-09-18-followup/evidence';mkdirSync(out+'/screenshots',{recursive:true});
// Headed browser, a few visible views only; no tile prefetch or bulk pan/zoom.
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--no-first-run','--disable-background-networking','--disable-sync','--remote-debugging-port=9361','--user-data-dir=/private/tmp/avantehnik-followup-browser','about:blank'],{stdio:'ignore'});
let targets;for(let n=0;n<60;n++){try{targets=await(await fetch('http://127.0.0.1:9361/json/list')).json();break;}catch{}await wait(250);}
const ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map(),errors=[],checks=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(m.result?.exceptionDetails)throw new Error(JSON.stringify(m.result.exceptionDetails));return m.result?.result?.value;};
const click=async text=>ev(`Array.from(document.querySelectorAll('[role="button"],button,[role="tab"]')).find(x=>x.innerText.trim()===${JSON.stringify(text)})?.click()`);
async function nav(path){await send('Page.navigate',{url:'http://127.0.0.1:8090'+path});await wait(1800);}
async function capture(name){const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(out+'/screenshots/'+name+'.png',Buffer.from(s.result.data,'base64'));return name+'.png';}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 for(const width of [390,320,430]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:844,deviceScaleFactor:1,mobile:true});await nav('/maps');
  let map;for(let n=0;n<40;n++){map=await ev(`(()=>{const f=document.querySelector('iframe');const d=f?.contentDocument;const p=d?.querySelector('.leaflet-popup');const r=p?.getBoundingClientRect();return {frame:!!f,loaded:d?.querySelector('#status')?.style.display==='none',popup:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom}:null,width:f?.clientWidth,height:f?.clientHeight,attribution:d?.querySelector('.leaflet-control-attribution')?.innerText,tiles:[...(d?.querySelectorAll('.leaflet-tile')||[])].filter(t=>t.complete&&t.naturalWidth>0).length,body:document.body.innerText};})()`);if(map.loaded)break;await wait(500);}
  const screenshot=await capture('map-'+width);checks.push({name:'map-'+width,screenshot,...map});assert.ok(map.loaded,JSON.stringify(map));assert.ok(map.popup.left>=0&&map.popup.right<=map.width+1);assert.ok(map.popup.top>=0&&map.popup.bottom<=map.height+1);assert.match(map.attribution,/OpenStreetMap/);assert.ok(map.tiles>0);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await nav('/maps');await wait(1500);
 await ev(`document.querySelector('[role="combobox"]')?.click()`);await wait(300);checks.push({name:'map-selector',screenshot:await capture('map-selector'),body:await ev('document.body.innerText')});
 await nav('/catalog');await wait(2000);const categories=await ev('document.body.innerText');checks.push({name:'categories',screenshot:await capture('catalog-categories'),body:categories});assert.match(categories,/Краны и вентили/);assert.match(categories,/2365/);
 await nav('/category/'+encodeURIComponent('category:краны и вентили'));await wait(2000);checks.push({name:'category-results',screenshot:await capture('catalog-category-results'),body:await ev('document.body.innerText')});
 await nav('/product/c1472a86-be89-451c-9a35-c8680a857fec');await wait(1800);const product=await ev('document.body.innerText');checks.push({name:'exact-product',screenshot:await capture('catalog-product'),body:product});assert.ok(!product.includes('Товар не найден'));
 await send('Network.setBlockedURLs',{urls:['*tile.openstreetmap.org*','*unpkg.com/leaflet*']});await nav('/maps');await wait(2000);const failure=await ev('document.body.innerText');checks.push({name:'map-offline',screenshot:await capture('map-fallback'),body:failure});assert.match(failure,/Карта временно недоступна/);assert.match(failure,/Открыть выбранный филиал/);
 await send('Network.setBlockedURLs',{urls:[]});await click('Повторить загрузку карты');await wait(5000);checks.push({name:'map-retry',screenshot:await capture('map-retry'),frame:await ev("!!document.querySelector('iframe')")});assert.equal(checks.at(-1).frame,true);assert.equal(errors.length,0);
 console.log('PASS',checks.map(x=>x.name));
}finally{writeFileSync(out+'/visual.json',JSON.stringify({checks,errors},null,2));ws.close();chrome.kill('SIGTERM');}
