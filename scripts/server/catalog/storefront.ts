import {productImageUrl} from '../../../src/lib/catalog/imageUrl';
import type pg from 'pg';
import {FEATURED_IMAGES} from '../../../src/lib/catalog/merchandising';
import {createCatalogHandler, type Row} from '../catalog';
import {fail} from '../security';
import {STOREFRONT_QUERY} from './storefront-query';

type CatalogRow = {
  product_id:string; product_name:string|null; product_image_url:string|null;
  product_description:string|null; category_id:string; category_name:string|null;
  category_slug:string|null; variant_id:string; variant_label:string|null;
  variant_sku:string|null; variant_price:number|string|null; variant_price_retail:number|string|null;
};
const label=(value:string|null)=>{
  const text=value?.trim()||'';
  return /\p{L}/u.test(text)&&text===text.toLocaleUpperCase('ru')?text[0].toLocaleUpperCase('ru')+text.slice(1).toLocaleLowerCase('ru'):text;
};
const price=(row:CatalogRow)=>{
  const retail=Number(row.variant_price_retail),base=Number(row.variant_price);
  const n=Number.isFinite(retail)&&retail>0?retail:base;
  return Number.isFinite(n)&&n>0?Math.round((n+Number.EPSILON)*100)/100:null;
};
export function mapStorefrontRows(rows:CatalogRow[]):Row[]{
  const products=new Map<string,Row>();
  for(const row of rows){
    if(!row.product_id||!row.variant_id)throw new Error('Invalid storefront product/variant');
    let product=products.get(row.product_id);
    if(!product){
      const original=row.product_image_url?.trim();
      const imageUrl=FEATURED_IMAGES[row.product_id] || (original?.startsWith('/')?'https://www.avantehnik.kg'+original:productImageUrl(original));
      product={id:row.product_id,name:label(row.product_name)||row.product_id,description:row.product_description,
        category:{id:row.category_id,name:label(row.category_name)||row.category_slug||row.category_id},imageUrl,
        // Visibility is not evidence of branch inventory. Checkout checks trusted offers.
        availabilityLabel:'Наличие уточняется',purchaseOptions:[],catalogSource:'storefront'};
      products.set(row.product_id,product);
    }
    const options=product.purchaseOptions as Row[];
    if(options.some(p=>p.id===row.variant_id))throw new Error('Duplicate storefront variant');
    options.push({id:row.variant_id,label:label(row.variant_label)||row.variant_sku||'Стандартный',sku:row.variant_sku,price:price(row)});
  }
  return [...products.values()].map(product=>{
    const options=(product.purchaseOptions as Row[]).sort((a,b)=>String(a.label).localeCompare(String(b.label),'ru',{numeric:true})||String(a.id).localeCompare(String(b.id)));
    const prices=options.map(p=>p.price).filter((p):p is number=>typeof p==='number');
    const min=prices.length?Math.min(...prices):null;
    return {...product,purchaseOptions:options,priceKgs:min,priceLabel:min===null?'Цена уточняется':`${options.length>1?'от ':''}${min.toLocaleString('ru-RU')} сом`};
  });
}
export function resolveStorefrontProduct(items:Row[],id:string):Row|undefined{
  const direct=items.find(p=>p.id===id);if(direct)return direct;
  for(const product of items){
    const option=(product.purchaseOptions as Row[]).find(v=>v.id===id);
    if(option)return {...product,id:option.id,parentProductId:product.id,name:`${product.name} · ${option.label}`,sku:option.sku,priceKgs:option.price,priceLabel:option.price===null?'Цена уточняется':`${Number(option.price).toLocaleString('ru-RU')} сом`,purchaseOptions:[]};
  }
}
export function createStorefrontCatalogGateway(pool:Pick<pg.Pool,'query'>|null){
  return createCatalogHandler(async()=>{
    if(!pool)fail('Каталог ещё не подключён.',503);
    const result=await pool.query(STOREFRONT_QUERY).catch(()=>fail('Каталог временно недоступен. Попробуйте позже.',503));
    return {items:mapStorefrontRows(result.rows),store:null,currencyCode:'KGS',currencyRateKgsPerUnit:1};
  },resolveStorefrontProduct);
}
