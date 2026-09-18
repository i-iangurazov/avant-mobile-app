import type {CartItemWithProduct,Product} from '../../types';
export const CART_STORAGE_KEY='avantehnik:cart:v1';
type Storage={getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<unknown>;removeItem(key:string):Promise<unknown>};
type State={items:CartItemWithProduct[];applied:string[]};
export function createCartStore(storage:Storage){
 let queue:Promise<unknown>=Promise.resolve();
 const run=<T,>(work:()=>Promise<T>):Promise<T>=>{const next=queue.then(work);queue=next.catch(()=>undefined);return next;};
 const read=async():Promise<State>=>{try{const parsed=JSON.parse(await storage.getItem(CART_STORAGE_KEY)||'null');return{items:Array.isArray(parsed)?parsed:Array.isArray(parsed?.items)?parsed.items:[],applied:Array.isArray(parsed?.applied)?parsed.applied:[]};}catch{return{items:[],applied:[]};}};
 const write=async(state:State)=>{await storage.setItem(CART_STORAGE_KEY,JSON.stringify(state));return state.items;};
 const mutate=(change:(state:State)=>State)=>run(async()=>write(change(await read())));
 return{
  getItems:()=>run(async()=>(await read()).items),
  setItems:(items:CartItemWithProduct[])=>mutate(state=>({...state,items})),
  add:(product:Product,quantity=1)=>mutate(state=>{
   const existing=state.items.find(item=>item.product_id===product.id);const total=(existing?.quantity||0)+quantity;
   if(!Number.isSafeInteger(quantity)||quantity<1||total>999)throw Error('Количество должно быть целым числом от 1 до 999.');
   return{...state,items:existing?state.items.map(item=>item.id===existing.id?{...item,quantity:total,product}:item):[...state.items,{id:`${product.id}-${Date.now()}`,product_id:product.id,product,quantity,created_at:new Date().toISOString()}]};
  }),
  updateQuantity:(id:string,quantity:number)=>mutate(state=>{
   if(!Number.isSafeInteger(quantity)||quantity>999)throw Error('Количество должно быть целым числом от 1 до 999.');
   return{...state,items:quantity<1?state.items.filter(item=>item.id!==id):state.items.map(item=>item.id===id?{...item,quantity}:item)};
  }),
  remove:(id:string)=>mutate(state=>({...state,items:state.items.filter(item=>item.id!==id)})),
  clear:()=>run(async()=>{await storage.removeItem(CART_STORAGE_KEY);}),
  consume:(items:CartItemWithProduct[],key:string)=>run(async()=>{
   const state=await read();if(state.applied.includes(key))return;
   const remaining=state.items.map(item=>({...item,quantity:item.quantity-(items.find(sent=>sent.id===item.id)?.quantity||0)})).filter(item=>item.quantity>0);
   await write({items:remaining,applied:[...state.applied.slice(-99),key]});
  })
 };
}
