import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPool,ensureSchema} from '../server/db';
import {assertTestDatabase,registerFixture} from './fixtures';
import {uploadMedia,requireOwnedMedia,type MediaProvider} from '../server/media';
const pool=createPool(process.env.TEST_DATABASE_URL || '')!;
async function main(){try{assertTestDatabase(pool);await ensureSchema(pool);
 const a=await registerFixture(pool,{name:'Media test',phone:`+996705${String(Date.now()).slice(-6)}`,password:'test-password'},'fixture');
 const id=randomUUID();let uploads=0;const provider:MediaProvider={upload:async()=>{uploads++;return{id,url:`https://media.test.invalid/${id}`,metadataStripped:true};},remove:async()=>{}};
 await assert.rejects(()=>uploadMedia(pool,a.user.id,Buffer.from('<svg onload="evil"/>').toString('base64'),provider));
 await assert.rejects(()=>uploadMedia(pool,a.user.id,'A'.repeat(2_800_001),provider));
 assert.equal(uploads,0);
 const photo=await uploadMedia(pool,a.user.id,Buffer.from([255,216,255,0,0,0]).toString('base64'),provider);
 await requireOwnedMedia(pool,a.user.id,[photo.url]);
 await assert.rejects(()=>requireOwnedMedia(pool,'another-account',[photo.url]));
 await assert.rejects(()=>requireOwnedMedia(pool,a.user.id,['https://attacker.invalid/photo']));
 console.log(JSON.stringify({suite:'media',checks:6,status:'PASS',provider:'injected fake; decoding/metadata stripping/storage integration BLOCKED'}));
}finally{await pool.end();}}
void main().catch(e=>{console.error(e);process.exitCode=1;});
