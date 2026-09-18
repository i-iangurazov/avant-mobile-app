import {readFileSync} from 'node:fs';
const original=globalThis.fetch;
const data=JSON.parse(readFileSync('/private/tmp/audit-real-products.json','utf8'));
globalThis.fetch=async(input,init)=>{
 const u=new URL(String(input));
 if(u.hostname==='api.telegram.org')return Response.json({ok:true,result:u.pathname.endsWith('getChatMember')?{status:'administrator'}:{message_id:777}});
 if(u.hostname==='audit-catalog.invalid'){
  if(u.pathname==='/categories')return Response.json({error:'Source endpoint returned 404 during read-only audit'}, {status:404});
  const filtered=u.searchParams.has('id')?data.items.filter(p=>p.id===u.searchParams.get('id')):data.items;
  return Response.json({...data,items:filtered,total:filtered.length,page:1,pageSize:filtered.length});
 }
 throw new Error('Audit runtime blocked non-fixture outbound fetch: '+u.hostname);
};
