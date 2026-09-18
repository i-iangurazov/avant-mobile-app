// Read-only browser fixture. This process has no DB, credentials or mutation routes.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createCatalogGateway} from '../server/catalog';
if(!process.env.CATALOG_CAPTURE)throw new Error('Set CATALOG_CAPTURE to a read-only public catalog capture');
const captured=JSON.parse(readFileSync(process.env.CATALOG_CAPTURE,'utf8'));
const gateway=createCatalogGateway('https://fixture.invalid','isolated-test-token',async input=>{const p=Number(new URL(String(input)).searchParams.get('page'));return Response.json({...captured,items:captured.items.slice((p-1)*100,p*100)});});
createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:8090');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Content-Type','application/json');if(req.method==='OPTIONS'){res.writeHead(204).end();return;}if(req.method!=='GET'){res.writeHead(405).end();return;}try{const url=new URL(req.url!,'http://127.0.0.1');res.end(JSON.stringify(await gateway(url.pathname,url.searchParams)));}catch(e:any){res.writeHead(e.statusCode||500);res.end(JSON.stringify({error:e.message}));}}).listen(8789,'127.0.0.1',()=>console.log('Isolated read-only catalog on 8789'));
