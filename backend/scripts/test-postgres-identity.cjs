// Real PostgreSQL integration test. All rows created here are rolled back.
// Sequences may advance, as with any PostgreSQL rolled-back insert.
require('dotenv').config({path:['.env.supabase','.env'],quiet:true});
require('ts-node/register');
require('reflect-metadata');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {Pool}=require('pg');
const {ConfigService}=require('@nestjs/config');
const {JwtService}=require('@nestjs/jwt');
const {buildPostgresOptions}=require('../src/common/database/postgres-options');
const {PostgresUsersService}=require('../src/users/postgres-users.service');
const {PostgresNotificationsService}=require('../src/notifications/postgres-notifications.service');
const {PostgresAuthService}=require('../src/auth/postgres-auth.service');
const {PostgresRolesService}=require('../src/roles/postgres-roles.service');
const {PostgresJwtStrategy}=require('../src/auth/strategies/postgres-jwt.strategy');
const {Test}=require('@nestjs/testing');
const {ValidationPipe,VersioningType}=require('@nestjs/common');
const {PostgresIdentityModule}=require('../src/postgres-identity.module');
const {DatabaseService}=require('../src/common/database/database.service');
const {StorageService}=require('../src/common/storage/storage.service');

async function main() {
  const pool=new Pool(buildPostgresOptions(process.env.DATABASE_URL,process.env.DATABASE_CA_CERT));
  const client=await pool.connect();
  const marker=randomUUID();
  let savepoint=0;
  const db={query:client.query.bind(client),transaction:async operation=>{
    const name=`identity_test_${++savepoint}`;
    await client.query(`SAVEPOINT ${name}`);
    try {const result=await operation(client);await client.query(`RELEASE SAVEPOINT ${name}`);return result;}
    catch(error) {await client.query(`ROLLBACK TO SAVEPOINT ${name}`);await client.query(`RELEASE SAVEPOINT ${name}`);throw error;}
  }};
  // Expected SQL errors must be wrapped in a savepoint to keep the outer test
  // transaction usable. No production JWT secret is used.
  const config=new ConfigService({JWT_SECRET:randomUUID()+randomUUID(),JWT_ACCESS_TTL:900,JWT_REFRESH_TTL:28800});
  const jwt=new JwtService({secret:config.get('JWT_SECRET')});
  const notices=new PostgresNotificationsService(db);
  const users=new PostgresUsersService(db,{uploadPublic:()=>{throw Error('Storage must not be called');}},notices);
  const auth=new PostgresAuthService(db,users,jwt,config,notices);
  const roles=new PostgresRolesService(db);
  const strategy=new PostgresJwtStrategy(config,auth);
  let app;
  try {
    await client.query('BEGIN');
    const role=await roles.create({name:`identity-test-${marker}`});
    await roles.update(role.id,{permissions:['users:view']});
    const email=`identity-test-${marker}@example.invalid`;
    const password=randomUUID();
    const user=await users.create({email,password,firstName:'Integration',lastName:marker,roleId:role.id},0);
    assert.equal(typeof user.id,'number');
    assert.equal(user.passwordHash,undefined);
    assert.equal(Object.keys(user).some(key=>key.startsWith('source_')),false);
    assert.equal(user.role.id,role.id);
    const login=await auth.login({email:email.toUpperCase(),password});
    assert.equal(login.user.passwordHash,undefined);
    assert.deepEqual(login.user.permissions,['users:view']);
    await assert.rejects(auth.login({email,password:'wrong-password'}),error=>error.getStatus()===401);
    const listing=await users.findAll(user.id,role.id,marker,1,10);
    assert.equal(listing.total,1);
    assert.equal(listing.data[0].passwordHash,undefined);
    await assert.rejects(db.transaction(()=>users.create({email,password,firstName:'Duplicate',lastName:marker,roleId:role.id},0)),error=>error.getStatus()===409);
    const token=jwt.verify(login.accessToken);
    await roles.update(role.id,{permissions:[]});
    const validated=await strategy.validate(token);
    assert.deepEqual(validated.permissions,[],'Old JWT must not retain removed permissions');
    const refresh=await auth.refresh(login.refreshToken);
    assert.equal(refresh.user.passwordHash,undefined);
    await assert.rejects(auth.refresh(login.refreshToken),error=>error.getStatus()===401);
    const access=jwt.verify(refresh.accessToken);
    await auth.logout(user.id,refresh.refreshToken,access.jti,access.exp);
    assert.equal(await auth.isTokenRevoked(access.jti),true);
    await assert.rejects(auth.refresh(refresh.refreshToken),error=>error.getStatus()===401);
    const newSession=await auth.login({email,password});
    await users.update(user.id,{status:'suspended'});
    await assert.rejects(auth.refresh(newSession.refreshToken),error=>error.getStatus()===401);
    await assert.rejects(strategy.validate(jwt.verify(newSession.accessToken)),error=>error.getStatus()===401);
    await users.update(user.id,{status:'active'});
    const notice=await notices.create({userId:user.id,title:'Integration test'},user.id);
    await assert.rejects(notices.markRead(notice.id,user.id+1),error=>error.getStatus()===403);
    assert.equal((await notices.markRead(notice.id,user.id)).read,true);
    await assert.rejects(roles.remove(role.id),error=>error.getStatus()===409);
    const expired=await auth.login({email,password});
    await client.query('UPDATE arm_app.refresh_tokens SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[user.id]);
    await assert.rejects(auth.refresh(expired.refreshToken),error=>error.getStatus()===401);
    // Bootstrap the actual controllers/guards using this same rollback-only DB.
    const module=await Test.createTestingModule({imports:[PostgresIdentityModule]})
      .overrideProvider(DatabaseService).useValue(db)
      .overrideProvider(ConfigService).useValue(config)
      .overrideProvider(StorageService).useValue({uploadPublic:()=>{throw Error('Unexpected storage call');}})
      .compile();
    app=module.createNestApplication({logger:false});
    app.enableVersioning({type:VersioningType.URI,defaultVersion:'1'});
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.listen(0,'127.0.0.1');
    const base=await app.getUrl();
    const request=(route,method='GET',body,accessToken)=>fetch(base+'/api/v1'+route,{method,headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await request('/users')).status,401);
    const loginResponse=await request('/auth/login','POST',{email,password});
    assert.equal(loginResponse.status,200);
    const httpSession=await loginResponse.json();
    assert.equal(httpSession.user.passwordHash,undefined);
    assert.equal((await request('/users/'+user.id,'PATCH',{roleId:1},httpSession.accessToken)).status,403);
    assert.equal((await request('/roles','POST',{name:'Unauthorized'},httpSession.accessToken)).status,403);
    assert.equal((await request('/users/'+user.id,'GET',undefined,httpSession.accessToken)).status,200);
    await users.update(user.id,{status:'pending'});
    assert.equal((await request('/users','GET',undefined,httpSession.accessToken)).status,403);
    assert.equal((await request('/auth/me','GET',undefined,httpSession.accessToken)).status,200);
    await users.update(user.id,{status:'active'});
    console.log('PASS: login, numeric IDs, private fields, SQL search, duplicate email, fresh permissions, refresh replay, logout, suspended user, notification ownership, role FK, expiration.');
    console.log('PASS: real HTTP bootstrap, unauthenticated rejection, login contract, role escalation denied, role creation denied, own profile, pending-account restrictions.');
  } finally {
    if(app) await app.close();
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}
main().catch(error=>{console.error(`Identity integration failed (${error.code??error.name??'error'}). No credentials or row contents logged.`);process.exitCode=1;});
