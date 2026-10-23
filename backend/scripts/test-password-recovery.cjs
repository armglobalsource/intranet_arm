// Real PostgreSQL, synthetic users, fake mailer, transaction always rolled back.
require('dotenv').config({path:['.env.runtime.local','.env.supabase','.env'],quiet:true});
require('ts-node/register');
require('reflect-metadata');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {Pool}=require('pg');
const {ConfigService}=require('@nestjs/config');
const {JwtService}=require('@nestjs/jwt');
const {buildPostgresOptions}=require('../src/common/database/postgres-options');
const {PostgresUsersService}=require('../src/users/postgres-users.service');
const {PostgresAuthService}=require('../src/auth/postgres-auth.service');
const {PasswordRecoveryService,RECOVERY_MESSAGE}=require('../src/auth/password-recovery.service');
const {PostgresJwtStrategy}=require('../src/auth/strategies/postgres-jwt.strategy');

async function main() {
  const pool=new Pool(buildPostgresOptions(process.env.DATABASE_URL,process.env.DATABASE_CA_CERT));
  const client=await pool.connect();
  let serial=0;
  const db={query:client.query.bind(client),transaction:async fn=>{
    const name=`recovery_test_${++serial}`;
    await client.query(`SAVEPOINT ${name}`);
    try {const value=await fn(client);await client.query(`RELEASE SAVEPOINT ${name}`);return value;}
    catch(error){await client.query(`ROLLBACK TO SAVEPOINT ${name}`);await client.query(`RELEASE SAVEPOINT ${name}`);throw error;}
  }};
  const notices={createForPermission:async()=>{}};
  const users=new PostgresUsersService(db,{},notices);
  const config=new ConfigService({JWT_SECRET:randomUUID()+randomUUID(),JWT_ACCESS_TTL:900,JWT_REFRESH_TTL:28800});
  const jwt=new JwtService({secret:config.get('JWT_SECRET')});
  const auth=new PostgresAuthService(db,users,jwt,config,notices);
  const strategy=new PostgresJwtStrategy(config,auth);
  const emails=[];
  const recovery=new PasswordRecoveryService(db,{settings:()=>({}),sendPasswordReset:async(to,token)=>emails.push({to,token})});
  try {
    await client.query('BEGIN');
    if((await client.query('SELECT current_user AS name')).rows[0].name!=='arm_api') await client.query('SET LOCAL ROLE arm_api');
    const email=`recovery-test-${randomUUID()}@example.invalid`;
    const password=randomUUID();
    const user=await users.selfRegister({email,password,firstName:'Recovery',lastName:'Test'});
    const original=await auth.login({email,password});
    assert.deepEqual(await recovery.request('missing-'+email),{message:RECOVERY_MESSAGE});
    assert.equal(emails.length,0);
    assert.deepEqual(await recovery.request(' '+email.toUpperCase()+' '),{message:RECOVERY_MESSAGE});
    assert.equal(emails.length,1);
    await recovery.request(email);
    assert.equal(emails.length,1,'Shared database cooldown must prevent duplicate emails');
    const token=emails[0].token;
    const stored=(await client.query('SELECT "tokenHash" FROM arm_app.password_reset_tokens WHERE "userId"=$1',[user.id])).rows[0];
    assert.notEqual(stored.tokenHash,token);
    assert.equal(stored.tokenHash,createHash('sha256').update(token).digest('hex'));
    await assert.rejects(recovery.reset(token,'short'),e=>e.getStatus()===400);
    await assert.rejects(recovery.reset(token,'🔐'.repeat(30)),e=>e.getStatus()===400);
    const newPassword=randomUUID();
    await recovery.reset(token,newPassword);
    await assert.rejects(recovery.reset(token,randomUUID()),e=>e.getStatus()===400);
    await assert.rejects(auth.login({email,password}),e=>e.getStatus()===401);
    await assert.rejects(auth.refresh(original.refreshToken),e=>e.getStatus()===401);
    await assert.rejects(strategy.validate(jwt.verify(original.accessToken)),e=>e.getStatus()===401);
    const current=await auth.login({email,password:newPassword});
    await strategy.validate(jwt.verify(current.accessToken));
    await client.query('UPDATE arm_app.password_reset_tokens SET "createdAt"=now()-interval \'2 minutes\' WHERE "userId"=$1',[user.id]);
    await recovery.request(email);
    const expired=emails.at(-1).token;
    await client.query('UPDATE arm_app.password_reset_tokens SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[user.id]);
    await assert.rejects(recovery.reset(expired,randomUUID()),e=>e.getStatus()===400);
    // A migrated account with no password must prove email ownership first.
    const legacy=await users.selfRegister({email:'legacy-'+email,firstName:'Legacy',lastName:'Test'});
    await assert.rejects(auth.register({email:legacy.email,password:randomUUID(),firstName:'Other',lastName:'Person'}),e=>e.getStatus()===409);
    await recovery.request(legacy.email);
    await recovery.reset(emails.at(-1).token,newPassword);
    assert.equal((await auth.login({email:legacy.email,password:newPassword})).user.id,legacy.id);
    // Changing email invalidates previously issued recovery links and sessions.
    await client.query('UPDATE arm_app.password_reset_tokens SET "createdAt"=now()-interval \'2 minutes\' WHERE "userId"=$1',[legacy.id]);
    await recovery.request(legacy.email);
    const stale=emails.at(-1).token;
    await users.update(legacy.id,{email:'changed-'+email});
    await assert.rejects(recovery.reset(stale,randomUUID()),e=>e.getStatus()===400);
    console.log('PASS: recovery delivery, hashes, cooldown, one-use/expired links, password policy, session revocation, legacy ownership and email changes (arm_api; all fixtures rolled back).');
  } finally {await client.query('ROLLBACK');client.release();await pool.end();}
}
main().catch(error=>{console.error('Recovery integration failed:',error.message);process.exitCode=1;});
