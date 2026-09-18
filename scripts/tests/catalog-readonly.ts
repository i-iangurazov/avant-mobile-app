// Explicitly read-only capture from the already-public mobile gateway. No secrets loaded.
import {createCatalogGateway} from '../server/catalog';
import {writeFileSync} from 'node:fs';
const out='docs/production-readiness/2026-09-18-followup/evidence/';
let calls=0,active=0,maxActive=0;const start=Date.now();
const gateway=createCatalogGateway('https://api-production-2e6d.up.railway.app','unused-read-only-adapter',async(input)=>{calls++;active++;maxActive=Math.max(maxActive,active);try{return await fetch(input,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});}finally{active--;}});
async function main(){
const categories=await gateway('/categories',new URLSearchParams());
const product=await gateway('/products',new URLSearchParams({id:'c1472a86-be89-451c-9a35-c8680a857fec'}));
writeFileSync(out+'gateway-real-source.json',JSON.stringify({time:new Date().toISOString(),method:'Local new gateway -> public deployed GET /products, no auth/mutations; shared Bazaar source reviewed locally',calls,maxActive,elapsedMs:Date.now()-start,categories,exactProduct:product},null,2));console.log({calls,maxActive,elapsedMs:Date.now()-start});

}
void main().catch(e=>{console.error(e);process.exitCode=1;});
