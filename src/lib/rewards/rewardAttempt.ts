import type {AttemptStorage} from '../orders/checkoutAttempt';
export type RewardResult={id:string;status:string;costMinor:string};
export type RewardAttempt={key:string;rewardId:string;title:string;accepted?:RewardResult};
export const rewardAttemptKey=(accountId:string)=>`avantehnik.reward-attempt.${accountId}`;
export async function readRewardAttempt(storage:AttemptStorage,accountId:string):Promise<RewardAttempt|null>{const raw=await storage.getItem(rewardAttemptKey(accountId));return raw?JSON.parse(raw):null;}
export function createRewardAttemptClient(storage:AttemptStorage){
 const queues=new Map<string,{rewardId:string;promise:Promise<RewardResult>}>();
 return {
  async submit(accountId:string,reward:{rewardId:string;title:string},send:(rewardId:string,key:string)=>Promise<RewardResult>):Promise<RewardResult>{
   const running=queues.get(accountId);if(running){if(running.rewardId!==reward.rewardId)throw new Error('Сначала проверьте результат предыдущего обмена.');return running.promise;}
   const work=(async()=>{
    let attempt=await readRewardAttempt(storage,accountId);
    if(attempt&&attempt.rewardId!==reward.rewardId)throw new Error('Сначала проверьте результат предыдущего обмена.');
    if(!attempt){attempt={...reward,key:`reward_${Date.now()}_${Math.random().toString(36).slice(2)}`};await storage.setItem(rewardAttemptKey(accountId),JSON.stringify(attempt));}
    if(attempt.accepted)return attempt.accepted;
    try{const accepted=await send(attempt.rewardId,attempt.key);await storage.setItem(rewardAttemptKey(accountId),JSON.stringify({...attempt,accepted}));return accepted;}
    catch(error){if(error&&typeof error==='object'&&'payload'in error&&error.payload&&typeof error.payload==='object'&&'requestNotCreated'in error.payload&&error.payload.requestNotCreated===true)await storage.removeItem(rewardAttemptKey(accountId));throw error;}
   })();queues.set(accountId,{rewardId:reward.rewardId,promise:work});try{return await work;}finally{queues.delete(accountId);}
  },
  async acknowledge(accountId:string){if(queues.has(accountId))throw new Error('Дождитесь результата обмена.');const attempt=await readRewardAttempt(storage,accountId);if(attempt&&!attempt.accepted)throw new Error('Сначала проверьте результат обмена.');await storage.removeItem(rewardAttemptKey(accountId));}
 };
}
