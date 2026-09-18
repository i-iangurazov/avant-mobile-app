import {adaptProducts,deriveCategoriesFromProducts,productMatchesCategory} from '../../src/lib/bazaar/adapters';
import {fail} from './security';
type Row=Record<string,unknown>;
type Snapshot={items:Row[];store:unknown;currencyCode:unknown;currencyRateKgsPerUnit:unknown};
export function createCatalogGateway(baseUrl:string,token:string,fetcher:typeof fetch=fetch){
 let cached:{expires:number;promise:Promise<Snapshot>}|null=null;
 const load=async():Promise<Snapshot>=>{
  const loadPage=async(page:number)=>{
   const response=await fetcher(`${baseUrl.replace(/\/$/,'')}/products?page=${page}&pageSize=100`,{headers:{Accept:'application/json',Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)}).catch(()=>fail('Каталог временно недоступен. Попробуйте позже.',502));
   if(!response.ok)fail('Каталог временно недоступен. Попробуйте позже.',502);
   const data=await response.json().catch(()=>fail('Сервис каталога вернул некорректные данные.',502)) as Record<string,unknown>;
   if(!data||typeof data!=='object'||!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||(data.total as number)<0)fail('Сервис каталога вернул некорректные данные.',502);
   return data as Row & {items:Row[];total:number};
  };
  const first=await loadPage(1),total=first.total;
  if(total>10000)fail('Каталог превышает допустимый размер. Обратитесь в поддержку.',503);
  const pages=[first],count=Math.max(1,Math.ceil(total/100));let next=2;
  // Bounded fan-out keeps the full source under the mobile request timeout without
  // allowing each consumer to fan out independently (the snapshot is single-flight).
  await Promise.all(Array.from({length:Math.min(3,count-1)},async()=>{while(next<=count){const page=next++;pages[page-1]=await loadPage(page);}}));
  const metadata=(data:Row)=>({store:data.store,currencyCode:data.currencyCode,currencyRateKgsPerUnit:data.currencyRateKgsPerUnit});
  const meta=metadata(first),items=new Map<string,Row>();
  for(const [index,data] of pages.entries()){
   if(data.total!==total)fail('Каталог изменился. Обновите список.',503);
   if(JSON.stringify(meta)!==JSON.stringify(metadata(data)))fail('Контекст каталога изменился. Обновите список.',503);
   if(data.items.length!==Math.min(100,total-index*100))fail('Сервис каталога вернул неполный список.',502);
   for(const item of data.items){
    if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id)fail('Сервис каталога вернул некорректный товар.',502);
    if(items.has(item.id))fail('Сервис каталога вернул неполный список.',502);items.set(item.id,item);
   }
  }
  return {items:[...items.values()],...meta};
 };
 const snapshot=()=>{
  if(!cached||cached.expires<Date.now()){
   const promise=load();cached={promise,expires:Date.now()+60_000};
   promise.catch(()=>{if(cached?.promise===promise)cached=null;});
  }
  return cached.promise;
 };
 return async(path:string,query:URLSearchParams)=>{
  if(!baseUrl||!token)fail('Каталог ещё не подключён.',503);
  const allowed=new Set(['page','pageSize','search','id','categoryId']);
  for(const key of query.keys())if(!allowed.has(key))fail('Неизвестный параметр каталога.',400);
  if(path!=='/products'&&path!=='/categories')fail('Маршрут каталога не найден.',404);
  const integer=(key:string,fallback:number,max:number)=>{const raw=query.get(key);if(raw===null)return fallback;const n=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n)||n<1||n>max)fail('Некорректная страница каталога.',400);return n;};
  const page=integer('page',1,10000),pageSize=integer('pageSize',50,100);
  const search=(query.get('search')||'').trim().toLocaleLowerCase('ru');if(search.length>200)fail('Слишком длинный поисковый запрос.',400);
  const data=await snapshot();
  if(path==='/categories')return deriveCategoriesFromProducts({items:data.items,total:data.items.length});
  const id=query.get('id'),categoryId=query.get('categoryId');
  const adapted=adaptProducts({items:data.items});
  const matches=adapted.filter(item=>(!id||item.id===id)&&(!categoryId||categoryId==='all-products'||productMatchesCategory(item,categoryId))&&(!search||[item.name,item.sku,item.category?.name].filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(search)));
  return {...data,items:matches.slice((page-1)*pageSize,page*pageSize).map(item=>item.raw),page,pageSize,total:matches.length};
 };
}
