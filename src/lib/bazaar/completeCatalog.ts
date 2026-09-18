import type {Product} from '../../types';
import {adaptProducts} from './adapters';
export async function loadCompleteCatalog(fetchPage:(page:number)=>Promise<unknown>) {
 const products=new Map<string,Product>();let expected:number|null=null;
 for(let page=1;page<=100;page++){
  const payload=await fetchPage(page);const rows=adaptProducts(payload);
  const total=payload&&typeof payload==='object'&&'total' in payload&&typeof payload.total==='number'?payload.total:null;
  if(expected!==null && total!==null && total!==expected)throw new Error('Каталог изменился. Обновите список.');
  expected=total;
  const before=products.size;for(const row of rows)products.set(row.id,row);
  if(expected!==null && products.size===expected)return [...products.values()];
  if(!rows.length){if(expected!==null&&products.size<expected)throw new Error('Сервер вернул неполный каталог. Попробуйте позже.');return [...products.values()];}
  if(products.size===before)throw new Error('Сервер каталога повторяет страницу. Попробуйте позже.');
 }
 throw new Error('Каталог слишком велик для текущей интеграции. Уточните товар у менеджера.');
}
export function orderedProductPage(products:Product[],query:{page:number;pageSize:number;sort?:'name'|'price_asc'|'price_desc';categoryId?:string;search?:string;inStock?:boolean;withPrice?:boolean}){
 const search=query.search?.trim().toLocaleLowerCase('ru');
 const filtered=products.filter(p=>(!query.categoryId||query.categoryId==='all-products'||p.category_id===query.categoryId)&&(!query.inStock||p.inStock===true||(p.stock_quantity||0)>0)&&(!query.withPrice||p.price!==null)&&(!search||[p.name,p.sku,p.brand,p.description,p.category?.name].filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(search)));
 filtered.sort((a,b)=>{
  if(query.sort?.startsWith('price')){if(a.price===null&&b.price!==null)return 1;if(b.price===null&&a.price!==null)return -1;const diff=(a.price??0)-(b.price??0);if(diff)return query.sort==='price_desc'?-diff:diff;}
  return a.name.localeCompare(b.name,'ru')||a.id.localeCompare(b.id);
 });
 return {products:filtered.slice((query.page-1)*query.pageSize,query.page*query.pageSize),page:query.page,pageSize:query.pageSize,total:filtered.length,hasMore:query.page*query.pageSize<filtered.length};
}
