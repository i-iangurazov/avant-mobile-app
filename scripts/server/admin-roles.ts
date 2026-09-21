import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {fail} from './security';
// This function is not exposed through public registration/profile endpoints.
export async function setAdministrator(pool:pg.Pool,actorId:string,accountId:string,active:boolean,ticket:string){
 if(!ticket.trim())fail('Укажите основание изменения роли.');
 const client=await pool.connect();try{
  await client.query('BEGIN');
  const actor=await client.query(`SELECT c.id FROM app_customers c JOIN app_account_roles r ON r.account_id=c.id
   WHERE c.id=$1 AND r.role='admin' AND r.is_active FOR UPDATE OF r`,[actorId]);
  if(!actor.rowCount)fail('Недостаточно прав.',403);
  const target=await client.query('SELECT id FROM app_customers WHERE id=$1 FOR UPDATE',[accountId]);
  if(!target.rowCount)fail('Аккаунт не найден.',404);
  await client.query(`INSERT INTO app_account_roles(account_id,role,is_active,granted_by) VALUES($1,'admin',$2,$3)
   ON CONFLICT(account_id,role) DO UPDATE SET is_active=EXCLUDED.is_active,granted_by=EXCLUDED.granted_by,granted_at=now()`,[accountId,active,actorId]);
  await client.query(`INSERT INTO app_admin_audit_log(id,actor_id,action,entity_type,entity_id,metadata)
   VALUES($1,$2,'admin.role_changed','customer',$3,$4::jsonb)`,[randomUUID(),actorId,accountId,JSON.stringify({active,ticket:ticket.trim()})]);
  // Revocation of this explicitly selected account is immediate; no mass operation.
  if(!active)await client.query('UPDATE app_sessions SET revoked_at=now() WHERE account_id=$1',[accountId]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
