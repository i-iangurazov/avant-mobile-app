// Storage is injected so request recovery can be tested without a React Native runtime.
export type Attempt<T> = { key: string; body: T; accepted?: unknown };
export type AttemptStorage = { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<unknown>; removeItem(key:string):Promise<unknown> };
export const attemptKey=(accountId:string)=>`avantehnik.checkout.${accountId}`;
const queues=new Map<string,Promise<unknown>>();
export async function submitAttempt<T,R>(storage:AttemptStorage, accountId:string, body:T,
 send:(body:T,key:string)=>Promise<R>, cleanup:(body:T,key:string)=>Promise<void>):Promise<R> {
 const storageKey=attemptKey(accountId);
 const previous=queues.get(storageKey);
 // A double tap shares exactly the same in-flight operation.
 if(previous) return previous as Promise<R>;
 const work=(async()=>{
  const stored=await storage.getItem(storageKey);
  const attempt:Attempt<T>=stored?JSON.parse(stored):{key:`order_${Date.now()}_${Math.random().toString(36).slice(2)}`,body};
  if(!stored) await storage.setItem(storageKey,JSON.stringify(attempt));
  let result: R;
  try { result=attempt.accepted as R ?? await send(attempt.body,attempt.key); }
  catch (error) {
    if (error && typeof error === 'object' && 'payload' in error && error.payload && typeof error.payload === 'object' && 'requestNotCreated' in error.payload && error.payload.requestNotCreated === true) await storage.removeItem(storageKey);
    throw error;
  }
  await storage.setItem(storageKey,JSON.stringify({...attempt,accepted:result}));
  await cleanup(attempt.body,attempt.key);
  await storage.removeItem(storageKey);
  return result;
 })();
 queues.set(storageKey,work);
 try{return await work;}finally{queues.delete(storageKey);}
}
