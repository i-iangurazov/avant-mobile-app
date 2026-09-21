import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createStorefrontCatalogGateway, mapStorefrontRows} from '../server/catalog/storefront';
import {FEATURED_PRODUCTS} from '../../src/lib/catalog/merchandising';
import {adaptProduct} from '../../src/lib/bazaar/adapters';
import {selectProductOption} from '../../src/lib/catalog/selectProductOption';
import {productImageUrl} from '../../src/lib/catalog/imageUrl';
import {trustedOrder} from '../server/order-trust';

async function main(){
 const url=process.env.TEST_DATABASE_URL||'';assert.equal(url,'postgresql://audit@127.0.0.1:55448/remediation','Use the isolated QA database only');
 const pool=new pg.Pool({connectionString:url});const client=await pool.connect();
 try{
 const gateway=createStorefrontCatalogGateway(pool);
 const first=await gateway('/products',new URLSearchParams({sort:'recommended',pageSize:'15'})) as any;
 assert.deepEqual(first.items.map((p:any)=>p.id),FEATURED_PRODUCTS.map(p=>p.id));
 assert.equal(first.total,845);
 const website=process.env.STOREFRONT_CAPTURE?JSON.parse(readFileSync(process.env.STOREFRONT_CAPTURE,'utf8')):null;
 if(website)for(const [i,p]of first.items.entries()){assert.equal(p.name,website[i].displayName);assert.equal(p.priceKgs,website[i].priceKgs);}
 const all:any[]=[];for(let page=1;page<=9;page++){const data=await gateway('/products',new URLSearchParams({sort:'recommended',pageSize:'100',page:String(page)}))as any;all.push(...data.items);}
 assert.equal(all.length,845);assert.equal(new Set(all.map(p=>p.id)).size,845);
 const count=all.filter(p=>p.imageUrl).length;assert.equal(count,842);assert.ok(all.slice(count).every(p=>!p.imageUrl));
 assert.ok(all.every(p=>p.inStock===undefined&&p.stockQty===undefined),'Do not infer inventory from visibility');
 const root=adaptProduct(first.items[0]);assert.ok(root.purchaseOptions!.length>1);
 assert.throws(()=>selectProductOption(root),/Выберите/);assert.throws(()=>selectProductOption(root,'foreign-variant'),/Выберите/);
 const option=root.purchaseOptions![1];const selected=selectProductOption(root,option.id);assert.equal(selected.id,option.id);assert.equal(selected.price,option.price);assert.equal(selected.parentProductId,root.id);
 const detail=await gateway('/products',new URLSearchParams({id:option.id})) as any;assert.equal(detail.items[0].id,option.id);assert.equal(detail.items[0].priceKgs,option.price);
 await assert.rejects(()=>gateway('/products',new URLSearchParams({organizationId:'foreign'})));
 const direct=await gateway('/products',new URLSearchParams({id:'missing'})) as any;assert.equal(direct.total,0);
 // Mutations below stay in a rolled-back local transaction.
 await client.query('BEGIN');
 await client.query(`INSERT INTO app_order_branches(id,organization_id,name,address,is_active,orders_enabled,delivery_enabled) VALUES('qa-storefront','fixture-org','QA','QA',true,true,true) ON CONFLICT DO NOTHING`);
 await client.query(`INSERT INTO app_order_offers(organization_id,branch_id,product_id,product_name,unit_price_minor,stock_quantity,reserved_quantity,is_active,valid_until) VALUES('fixture-org','qa-storefront',$1,'stale name',1,5,0,true,now()+interval '1 hour') ON CONFLICT(organization_id,branch_id,product_id) DO UPDATE SET unit_price_minor=1,stock_quantity=5,reserved_quantity=0,valid_until=now()+interval '1 hour'`,[option.id]);
 const payload:any={deliveryMethod:'pickup',storeId:'qa-storefront',items:[{productId:option.id,productName:'forged',unitPrice:0.01,quantity:1}]};
 const context={organizationId:'fixture-org',catalogSource:'database'};
 const quote=await trustedOrder(client,payload,context,false);assert.equal(quote.items[0].unitPrice,option.price);assert.notEqual(quote.items[0].productName,'forged');
 await assert.rejects(()=>trustedOrder(client,payload,context,true),/Цена изменилась/);
 const valid={...payload,items:quote.items};await trustedOrder(client,valid,context,true);
 await client.query('UPDATE "Variant" SET "priceRetail"=$2 WHERE id=$1',[option.id,Number(option.price)+1]);
 await assert.rejects(()=>trustedOrder(client,valid,context,true),/Цена изменилась/);
 const quote2=await trustedOrder(client,valid,context,false);assert.equal(quote2.items[0].unitPrice,Number(option.price)+1);
 await client.query('UPDATE "Variant" SET "isActive"=false WHERE id=$1',[option.id]);
 await assert.rejects(()=>trustedOrder(client,{...valid,items:quote2.items},context,true),/недоступен/);
 const inactiveGateway=createStorefrontCatalogGateway({query:client.query.bind(client)} as any);
 const inactive=await inactiveGateway('/products',new URLSearchParams({id:option.id})) as any;assert.equal(inactive.total,0);
 await client.query('UPDATE "Variant" SET "isActive"=true WHERE id=$1',[option.id]);
 for(const table of ['Product','Category']){
   const id=table==='Product'?root.id:first.items[0].category.id;
   await client.query(`UPDATE "${table}" SET "isActive"=false WHERE id=$1`,[id]);
   const hidden=await createStorefrontCatalogGateway({query:client.query.bind(client)} as any)('/products',new URLSearchParams({id:root.id})) as any;assert.equal(hidden.total,0);
   await assert.rejects(()=>trustedOrder(client,valid,context,false),/недоступен/);
   await client.query(`UPDATE "${table}" SET "isActive"=true WHERE id=$1`,[id]);
 }
 await client.query('ROLLBACK');
 assert.deepEqual(mapStorefrontRows([]),[]);
 assert.equal(productImageUrl('javascript:alert(1)'),null);
 assert.equal(productImageUrl('data:image/svg+xml;base64,PHN2Zz4='),null);
 assert.equal(productImageUrl('data:image/jpeg;base64,'+'A'.repeat(350001)),null);
 assert.equal(productImageUrl('data:image/jpeg;base64,/9j/AA=='),'data:image/jpeg;base64,/9j/AA==');
 const result={status:'PASS',source:'shared storefront Product/Variant tables; local replay of SELECT-only production capture',products:845,variants:2147,withImages:count,featuredMatched:15,scenarios:['website names/prices/15 IDs match','global photo order over nine pages without duplicates','unknown inventory remains unknown','root requires explicit variant; foreign variant rejected','variant detail and price match cart selection','client context injection rejected','trusted quote ignores client and stale inventory price','price changes between quote/submit rejected','inactive variants/products/categories hidden and cannot order','test mutations rolled back']};
 const dir=process.env.REGRESSION_EVIDENCE_DIR||'artifacts/device-20260921/';mkdirSync(dir,{recursive:true});writeFileSync(dir+'storefront-catalog.json',JSON.stringify(result,null,2));console.log(result);
 }finally{await client.query('ROLLBACK').catch(()=>{});client.release();await pool.end();}
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
