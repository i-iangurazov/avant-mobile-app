import type pg from 'pg';
import {fail} from './security';
export async function listPublicDocuments(database:pg.Pool | pg.PoolClient) {
 return (await database.query<{kind:string;version:string;title:string;body:string}>(
  'SELECT kind,version,title,body FROM app_public_documents WHERE is_current AND approved_at <= now() ORDER BY kind')).rows;
}
export async function requireConsentVersions(database:pg.Pool | pg.PoolClient, programVersion?:string, privacyVersion?:string) {
 const documents=await listPublicDocuments(database);
 const program=documents.find(d=>d.kind==='loyalty'); const privacy=documents.find(d=>d.kind==='privacy');
 if(!program || !privacy) fail('Правила программы ещё не опубликованы. Обратитесь в поддержку.',503);
 if(program.version!==programVersion || privacy.version!==privacyVersion) fail('Условия обновились. Прочитайте действующие документы и подтвердите согласие снова.',409);
}
