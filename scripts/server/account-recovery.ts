import {createHash, randomBytes, randomUUID} from 'node:crypto';
import type pg from 'pg';
import {hashPassword, isValidAccountPhone, normalizePhone, verifyPassword} from './auth';
import {fail, rateLimit} from './security';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const accepted = {accepted: true, message: 'Если аккаунт с таким номером существует, заявка передана в поддержку. Дождитесь проверки владельца аккаунта.'};

export async function requestAccountRecovery(pool: pg.Pool, phoneInput: string, contactNote: string) {
  const phone = normalizePhone(phoneInput);
  if (!isValidAccountPhone(phone) || contactNote.trim().length < 5 || contactNote.length > 1000) fail('Укажите телефон и способ связи с вами.');
  await rateLimit(pool,'recovery-account',phone,3,24 * 60 * 60_000);
  await pool.query(`INSERT INTO app_account_recovery(id,account_id,phone_at_request,contact_note)
    SELECT $1,id,phone,$3 FROM app_customers WHERE phone=$2
    ON CONFLICT(account_id) WHERE status='pending' DO NOTHING`,[randomUUID(),phone,contactNote.trim()]);
  // Same response for existing, unknown and already pending accounts. No token here.
  return accepted;
}

async function requireRecoveryAdministrator(db: pg.Pool | pg.PoolClient, id: string, password?: string) {
  const actor=(await db.query(`SELECT c.password_hash FROM app_customers c JOIN app_account_roles r ON r.account_id=c.id
    WHERE c.id=$1 AND r.role='admin' AND r.is_active`,[id])).rows[0];
  if (!actor) fail('Недостаточно прав.',403);
  if (password !== undefined && !verifyPassword(password,actor.password_hash)) fail('Неверный текущий пароль администратора.',401);
}

export async function listAccountRecovery(pool: pg.Pool, actorId: string) {
  await requireRecoveryAdministrator(pool,actorId);
  return (await pool.query(`SELECT r.id,r.phone_at_request AS phone,r.contact_note AS "contactNote",r.status,
    r.created_at AS "createdAt",c.name FROM app_account_recovery r JOIN app_customers c ON c.id=r.account_id
    WHERE r.status IN ('pending','approved') ORDER BY r.created_at DESC LIMIT 100`)).rows;
}

export async function approveAccountRecovery(pool: pg.Pool, actorId: string, requestId: string, password: string, note: string) {
  if (note.trim().length < 10 || note.length > 1000) fail('Укажите основание и результат ручной проверки владельца аккаунта.');
  await rateLimit(pool,'recovery-approval',actorId,10,60 * 60_000);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await requireRecoveryAdministrator(client,actorId,password);
    const request=(await client.query(`SELECT r.*,c.phone FROM app_account_recovery r JOIN app_customers c ON c.id=r.account_id
      WHERE r.id=$1 FOR UPDATE OF c,r`,[requestId])).rows[0];
    if (!request || request.status!=='pending' || request.phone!==request.phone_at_request) fail('Заявка недоступна или уже обработана.',409);
    const token=randomBytes(32).toString('base64url');
    await client.query("UPDATE app_account_recovery SET status='cancelled',token_hash=NULL WHERE account_id=$1 AND status='approved'",[request.account_id]);
    await client.query(`UPDATE app_account_recovery SET status='approved',reviewed_by=$2,review_note=$3,reviewed_at=now(),
      token_hash=$4,token_expires_at=now()+interval '30 minutes' WHERE id=$1`,[requestId,actorId,note.trim(),digest(token)]);
    await client.query(`INSERT INTO app_admin_audit_log(id,actor_id,action,entity_type,entity_id,metadata)
      VALUES($1,$2,'account.recovery_approved','customer',$3,$4::jsonb)`,[randomUUID(),actorId,request.account_id,JSON.stringify({requestId,note:note.trim()})]);
    await client.query('COMMIT');
    // Delivered manually by staff only after identity review. Never put this in logs/outbox.
    return {url:`avantehnik://password-reset?token=${token}`,expiresInSeconds:1800};
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}

export async function completeAccountRecovery(pool: pg.Pool, token: string, password: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) fail('Ссылка недействительна или уже использована.');
  if (password.length<8 || password.length>200) fail('Пароль должен содержать от 8 до 200 символов.');
  const hash=digest(token);const client=await pool.connect();
  try {
    await client.query('BEGIN');
    // Account lock serializes resets with phone changes/deletion and concurrent resets.
    const account=(await client.query(`SELECT c.id,c.phone FROM app_customers c JOIN app_account_recovery r ON r.account_id=c.id
      WHERE r.token_hash=$1 FOR UPDATE OF c`,[hash])).rows[0];
    if (!account) fail('Ссылка недействительна или уже использована.');
    const request=(await client.query(`SELECT * FROM app_account_recovery WHERE token_hash=$1 FOR UPDATE`,[hash])).rows[0];
    if (!request || request.status!=='approved' || request.consumed_at || new Date(request.token_expires_at).getTime()<=Date.now() || request.phone_at_request!==account.phone) fail('Ссылка недействительна или уже использована.');
    await client.query('UPDATE app_customers SET password_hash=$2,updated_at=now() WHERE id=$1',[account.id,hashPassword(password)]);
    await client.query('UPDATE app_sessions SET revoked_at=now() WHERE account_id=$1',[account.id]);
    await client.query("UPDATE app_account_recovery SET status='cancelled',token_hash=NULL WHERE account_id=$1 AND id<>$2 AND status IN ('approved','pending')",[account.id,request.id]);
    await client.query("UPDATE app_account_recovery SET status='completed',consumed_at=now(),token_hash=NULL WHERE id=$1",[request.id]);
    await client.query('COMMIT');return {success:true};
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
