import {readFileSync,writeFileSync,existsSync} from 'node:fs';
if(process.env.DATABASE_URL!=='postgresql://audit@127.0.0.1:55448/remediation')throw new Error('This test adapter requires the isolated remediation database');
const snapshot=JSON.parse(readFileSync('docs/production-readiness/2026-09-18-340b960/evidence/catalog-snapshot.json','utf8'));
const otpFile='/private/tmp/avantehnik-remediation-otp.json';
globalThis.fetch=async(input,init)=>{
 const url=new URL(String(input));
 if(url.hostname==='api.telegram.org')return Response.json({ok:true,result:url.pathname.endsWith('getChatMember')?{status:'administrator'}:{message_id:777}});
 if(url.hostname==='sms.fixture.invalid'){
  const message=JSON.parse(init.body);const codes=existsSync(otpFile)?JSON.parse(readFileSync(otpFile,'utf8')):{};codes[message.challengeId]=message;writeFileSync(otpFile,JSON.stringify(codes),{mode:0o600});return Response.json({sent:true});
 }
 if(url.hostname==='catalog.fixture.invalid'){
  if(url.pathname==='/categories')return Response.json({error:'Baseline source has no categories'}, {status:404});
  const rows=snapshot.items || snapshot.data || snapshot.products || [];
  const found=url.searchParams.has('id')?rows.filter(p=>p.id===url.searchParams.get('id')):rows;
  const page=Number(url.searchParams.get('page')||1),size=Number(url.searchParams.get('pageSize')||50);
  return Response.json({items:found.slice((page-1)*size,page*size),total:found.length,page,pageSize:size});
 }
 throw new Error('Isolated test blocked external fetch: '+url.hostname);
};
