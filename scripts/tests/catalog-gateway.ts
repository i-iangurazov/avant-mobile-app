import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createCatalogGateway} from '../server/catalog';
import {adaptProduct,deriveCategoriesFromProducts} from '../../src/lib/bazaar/adapters';
import {orderedProductPage} from '../../src/lib/bazaar/completeCatalog';
const evidence=process.env.REGRESSION_EVIDENCE_DIR || 'artifacts/device-20260921/';
async function main(){
 let requests=0;const calls:string[]=[];
 const items=Array.from({length:137},(_,i)=>({id:`sku-${i}`,name:`Товар ${i}`,category:i===136?'Краны и вентили':null,categories:i===136?['Краны и вентили','Водоснабжение']:[],priceKgs:20+i,stockQty:2,imageObjects:[]}));
 const gateway=createCatalogGateway('https://catalog.fixture.invalid','private-server-token',async(input,init)=>{
  requests++;calls.push(String(input));assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer private-server-token');
  const page=Number(new URL(String(input)).searchParams.get('page'));return Response.json({items:items.slice((page-1)*100,page*100),total:137,store:{id:'trusted-store'},currencyCode:'KGS'});
 });
 const [categories,detail]=await Promise.all([gateway('/categories',new URLSearchParams()),gateway('/products',new URLSearchParams({id:'sku-136'}))]);
 assert.equal(requests,2);assert.ok(Array.isArray(categories));assert.equal(categories.length,3);assert.equal((detail as any).items[0].id,'sku-136');assert.equal((detail as any).total,1);
 const category=categories.find((x:any)=>x.name==='Водоснабжение');assert.equal(category?.product_count,1);
 const filtered=await gateway('/products',new URLSearchParams({categoryId:category!.id}));assert.equal((filtered as any).items.length,1);
 assert.equal(orderedProductPage(items.map(adaptProduct),{page:1,pageSize:30,categoryId:category!.id}).total,1);
 const missing=await gateway('/products',new URLSearchParams({id:'foreign-id'}));assert.equal((missing as any).total,0);
 const invalidQueries:Record<string,string>[]=[{storeId:'foreign'},{organizationId:'foreign'},{page:'-1'},{page:'1.5'},{pageSize:'101'},{search:'x'.repeat(201)}];
 for(const q of invalidQueries)await assert.rejects(()=>gateway('/products',new URLSearchParams(q)));
 assert.equal(requests,2);assert.ok(calls.every(url=>!url.includes('organizationId')&&!url.includes('storeId')));
 const broken=createCatalogGateway('https://fixture.invalid','fixture',async()=>Response.json({items:items.slice(0,100),total:137}));await assert.rejects(()=>broken('/products',new URLSearchParams()),/неполный/);
 const html=createCatalogGateway('https://fixture.invalid','fixture',async()=>new Response('<html>not json</html>'));await assert.rejects(()=>html('/products',new URLSearchParams()));
 for(const status of ['unavailable','out_of_stock','not_available'])assert.equal(adaptProduct({id:'negative',availabilityStatus:status}).inStock,false);
 assert.equal(adaptProduct({id:'negative',stockQty:-1,inStock:true}).inStock,false);
 assert.equal(adaptProduct({id:'image',imageObjects:[],images:['https://images.example/item.jpg']}).imageUrl,'https://images.example/item.jpg');
 assert.equal(adaptProduct({id:'image',imageObjects:[{url:'https://images.example/item.jpg'}]}).imageUrl,'https://images.example/item.jpg');
 assert.equal(adaptProduct({id:'unsafe',imageUrl:'javascript:alert(1)',images:[null]}).imageUrl,null);
 let actual:ReturnType<typeof deriveCategoriesFromProducts>|undefined;
 if(process.env.CATALOG_CAPTURE){const live=JSON.parse(readFileSync(process.env.CATALOG_CAPTURE,'utf8'));actual=deriveCategoriesFromProducts(live);assert.equal(actual.find(x=>x.name==='Краны и вентили')?.product_count,2);assert.equal(actual.find(x=>x.id==='all-products')?.product_count,2365);}
 const result={status:'PASS',scenarios:['concurrent single-flight full catalog','last-page exact ID','multiple categories','secondary category client/server','foreign product absent','six invalid/context-injection queries','repeated upstream page','invalid upstream JSON','three negative stock statuses','negative stock overrides flag','imageObjects and empty-array fallback','unsafe image rejected'],upstreamRequestsForConcurrentFullCategoriesAndLastPageDetail:requests,actualCategories:actual?.map(x=>({id:x.id,name:x.name,count:x.product_count}))};mkdirSync(evidence,{recursive:true});writeFileSync(evidence+'catalog-gateway.json',JSON.stringify(result,null,2));console.log(result);
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
