import type pg from 'pg';
import { registerCustomer } from '../server/auth';
export function assertTestDatabase(pool:pg.Pool) {
 const url = new URL(pool.options.connectionString || 'invalid:');
 if (!['127.0.0.1','localhost'].includes(url.hostname) || !['/remediation','/audit'].includes(url.pathname) || url.port!=='55448') throw new Error('Fixtures require isolated audit/remediation DB on 55448');
}
export async function registerFixture(pool:pg.Pool,payload:Parameters<typeof registerCustomer>[1],secret:string) {
 assertTestDatabase(pool);
 await installFixtureDocuments(pool);
 if(payload.plumberApplication) payload={...payload,plumberApplication:{...payload.plumberApplication,programDocumentVersion:'fixture-v1',privacyDocumentVersion:'fixture-v1'}};
 return registerCustomer(pool,payload,secret);
}

export async function installFixtureDocuments(pool:pg.Pool){
 assertTestDatabase(pool);
 for(const kind of ['privacy','loyalty','terms','deletion'])await pool.query(`INSERT INTO app_public_documents(kind,version,title,body,approved_at)
 VALUES($1,'fixture-v1',$2,'ТЕСТОВЫЙ ДОКУМЕНТ. Только изолированная проверка. Не является действующим условием Авантехник.',now()) ON CONFLICT DO NOTHING`,[kind,`Тест: ${kind}`]);
}
