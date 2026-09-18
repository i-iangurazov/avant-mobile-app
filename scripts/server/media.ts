import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {fail} from './security';
export type MediaProvider={upload:(input:{id:string;accountId:string;mime:string;dataBase64:string})=>Promise<{id:string;url:string;metadataStripped:boolean}>;remove:(id:string)=>Promise<void>};
export function mediaProvider(endpoint:string,token:string,allowedHost:string):MediaProvider {
 const call=async(path:string,body:unknown)=>{
  if(!endpoint || !token || !allowedHost || new URL(endpoint).protocol!=='https:')fail('Загрузка фотографий ещё не подключена. Можно отправить анкету без фото.',503);
  const response=await fetch(`${endpoint.replace(/\/$/,'')}${path}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)fail('Фотосервис временно недоступен.',503);
  return response.json();
 };
 return {upload:async input=>{const asset=await call('/upload',input) as {id:string;url:string;metadataStripped:boolean};
  if(typeof asset.id!=='string' || typeof asset.url!=='string' || new URL(asset.url).protocol!=='https:' || new URL(asset.url).host!==allowedHost || asset.metadataStripped!==true)fail('Фотосервис вернул некорректный ответ.',502);
  return asset;},remove:async id=>{const result=await call('/delete',{id}) as {deleted:boolean};if(result.deleted!==true)fail('Не удалось удалить фотографию из хранилища.',503);}};
}
export async function uploadMedia(pool:pg.Pool,accountId:string,data:string,provider:MediaProvider){
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length>2_800_000)fail('Выберите JPEG или PNG размером до 2 МБ.',413);
 const bytes=Buffer.from(data,'base64');
 const mime=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':null;
 if(!mime || bytes.length>2*1024*1024)fail('Поддерживаются только JPEG и PNG до 2 МБ.',400);
 const id=randomUUID();const asset=await provider.upload({id,accountId,mime,dataBase64:data});
 try{await pool.query('INSERT INTO app_uploaded_media(id,account_id,provider_id,url) VALUES($1,$2,$3,$4)',[id,accountId,asset.id,asset.url]);}
 catch(error){await provider.remove(asset.id);throw error;}
 return {id,url:asset.url};
}
export async function requireOwnedMedia(database:pg.Pool | pg.PoolClient,accountId:string,urls:string[]){
 for(const url of urls){if(!(await database.query('SELECT id FROM app_uploaded_media WHERE account_id=$1 AND url=$2',[accountId,url])).rowCount)fail('Прикрепите фотографию со своего устройства заново.',400);}
}
