import assert from 'node:assert/strict';
import {loadCompleteCatalog,orderedProductPage} from '../../src/lib/bazaar/completeCatalog';
import {createCartStore,CART_STORAGE_KEY} from '../../src/lib/cart/cartStore';
import type {Product} from '../../src/types';
import {formatBonus} from '../../src/lib/programFormat';
async function main(){
 const rows=Array.from({length:137},(_,i)=>({id:`sku-${i}`,name:`Товар ${String(137-i).padStart(3,'0')}`,price:137-i,stockQty:1}));
 const all=await loadCompleteCatalog(async page=>({data:rows.slice((page-1)*50,page*50),total:rows.length}));
 const first=orderedProductPage(all,{page:1,pageSize:30,sort:'price_asc'});const next=orderedProductPage(all,{page:2,pageSize:30,sort:'price_asc'});
 assert.equal(first.products[0].price,1);assert.equal(first.products.at(-1)!.price,30);assert.equal(next.products[0].price,31);assert.equal(first.total,137);
 const name=orderedProductPage(all,{page:1,pageSize:30,sort:'name'});assert.equal(name.products[0].name,'Товар 001');
 await assert.rejects(()=>loadCompleteCatalog(async()=>({data:rows.slice(0,50),total:137})),/повторяет/);
 await assert.rejects(()=>loadCompleteCatalog(async page=>({data:page===1?rows.slice(0,50):[],total:137})),/неполный/);
 assert.equal(orderedProductPage(all,{page:1,pageSize:30,search:'Товар 100'}).total,1);
 for(const [minor,expected] of [[0,'0 бонусов'],[100,'1 бонус'],[200,'2 бонуса'],[400,'4 бонуса'],[500,'5 бонусов'],[1100,'11 бонусов'],[2100,'21 бонус'],[101,'1,01 бонуса']] as const)assert.equal(formatBonus(minor),expected);
 const values=new Map<string,string>();const storage={getItem:async(k:string)=>values.get(k)||null,setItem:async(k:string,v:string)=>{values.set(k,v);},removeItem:async(k:string)=>{values.delete(k);}};
 const cart=createCartStore(storage);const product={id:'cart-fixture',name:'Test',price:1} as Product;
 await Promise.all(Array.from({length:20},()=>cart.add(product)));assert.equal((await cart.getItems())[0].quantity,20);
 const submitted=[{...(await cart.getItems())[0],quantity:10}];
 await Promise.all([cart.consume(submitted,'accepted-key'),cart.add(product,2),cart.consume(submitted,'accepted-key')]);assert.equal((await cart.getItems())[0].quantity,12);
 await assert.rejects(()=>cart.add(product,0.5));assert.equal((await cart.getItems())[0].quantity,12);
 await Promise.all([cart.add(product),cart.clear()]);assert.equal((await cart.getItems()).length,0);
 values.set(CART_STORAGE_KEY,'corrupt');await cart.add(product);assert.equal((await cart.getItems()).length,1);
 console.log(JSON.stringify({suite:'catalog/localization',checks:22,status:'PASS',catalog:'137 fixtures, provider pages of 50, globally sorted pages of 30'}));
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
