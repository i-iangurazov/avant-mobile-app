import assert from 'node:assert/strict';
import Module from 'node:module';
import {createCatalogGateway} from '../server/catalog';
import {FEATURED_PRODUCTS} from '../../src/lib/catalog/merchandising';

async function main() {
  const loader = Module as unknown as {_load: (id: string, ...args: unknown[]) => unknown};
  const original = loader._load;
  loader._load = function(id, ...args) {return id === 'react-native' ? {Platform:{OS:'android'}} : original.call(this, id, ...args);};
  const {bazaarClient, getProducts, getProductsPage} = await import('../../src/lib/bazaar/client');
  loader._load = original;
  const featured = FEATURED_PRODUCTS.map(p => ({id:p.id, name:p.name, priceKgs:10, imageUrl:'https://images.example/item.jpg'}));
  const items = [...Array.from({length:105}, (_,i)=>({id:`empty-${i}`, name:`А ${i}`, priceKgs:1})), ...featured.toReversed()];
  const gateway = createCatalogGateway('https://fixture.invalid', 'fixture', async input => {
    const page = Number(new URL(String(input)).searchParams.get('page'));
    return Response.json({items:items.slice((page-1)*100,page*100),total:items.length});
  });
  const calls: string[] = [];
  const request = bazaarClient.request;
  try {
    bazaarClient.request = (async(path:string) => {calls.push(path); const url = new URL(path,'https://fixture.invalid'); return gateway(url.pathname, url.searchParams);}) as typeof bazaarClient.request;
    const preview = await getProducts({limit:15});
    assert.equal(calls.length,1);
    assert.deepEqual(preview.map(p=>p.id),FEATURED_PRODUCTS.map(p=>p.id));
    const fullPage = await getProductsPage({pageSize:40});
    assert.deepEqual(fullPage.products.slice(0,15).map(p=>p.id),preview.map(p=>p.id));
    const all = await getProducts();
    assert.equal(all.length,120); assert.equal(new Set(all.map(p=>p.id)).size,120);
    assert.equal((await getProducts({limit:4,sort:'price_asc'}))[0].price,1);
    assert.equal((await getProducts({search:'Гибкий',limit:15}))[0].id,FEATURED_PRODUCTS[2].id);
    // A changing snapshot must not silently return a partial catalogue.
    let count=0;
    bazaarClient.request = (async()=>({items:count++===0?items.slice(0,100):items.slice(100),total:count===1?120:121})) as typeof bazaarClient.request;
    await assert.rejects(()=>getProducts());
    console.log('PASS: Android client preview = first 15 catalogue entries; one preview request, complete pagination, explicit price/search, reject changing snapshot.');
  } finally {bazaarClient.request=request;}
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
