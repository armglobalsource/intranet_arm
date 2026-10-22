import { describe,it,expect,vi } from 'vitest';
import { PostgresAuthService } from './postgres-auth.service';
import { PostgresJwtStrategy } from './strategies/postgres-jwt.strategy';
import { PostgresUsersPermissionsGuard } from './guards/postgres-users-permissions.guard';
import { UsersController } from '../users/users.controller';
import { apiRows,insertIdentity } from '../common/database/identity-sql';

describe('PostgreSQL identity security',()=>{
  it('rejects an expired refresh token before issuing another one',async()=>{
    const client={query:vi.fn().mockResolvedValue({rows:[{id:1,userId:2,expiresAt:new Date(0),revokedAt:null}],fields:[]})};
    const db={transaction:(fn:any)=>fn(client)};
    const jwt={sign:vi.fn()};
    const service=new PostgresAuthService(db as any,{} as any,jwt as any,{} as any,{} as any);
    await expect(service.refresh('old-token')).rejects.toMatchObject({status:401});
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  it('uses current permissions and campus instead of stale JWT claims',async()=>{
    const auth={isTokenRevoked:vi.fn().mockResolvedValue(false),getMe:vi.fn().mockResolvedValue({status:'active',email:'test@example.invalid',campusId:8,roleId:2,permissions:[]}),getRole:vi.fn().mockResolvedValue({id:2,name:'user',permissions:[]})};
    const strategy=new PostgresJwtStrategy({get:()=> 'x'.repeat(40)} as any,auth as any);
    const result=await strategy.validate({sub:1,jti:'test',permissions:['*'],role:'admin',campusId:1});
    expect(result).toMatchObject({permissions:[],role:'user',campusId:8});
  });
  it('revokes simulated role access when the real user is no longer an administrator',async()=>{
    const auth={isTokenRevoked:vi.fn().mockResolvedValue(false),getMe:vi.fn().mockResolvedValue({status:'active',role:{name:'user'},roleId:2,permissions:[]}),getRole:vi.fn().mockResolvedValue({id:2,name:'user',permissions:[]})};
    const strategy=new PostgresJwtStrategy({get:()=> 'x'.repeat(40)} as any,auth as any);
    await expect(strategy.validate({sub:1,jti:'test',impersonating:true,roleId:3})).rejects.toMatchObject({status:401});
  });
  it('does not allow a user to edit their own role through the generic update endpoint',()=>{
    const guard=new PostgresUsersPermissionsGuard();
    const context={getClass:()=>UsersController,getHandler:()=>({name:'update'}),switchToHttp:()=>({getRequest:()=>({method:'PATCH',params:{id:'1'},user:{sub:1,permissions:['users:view']}})})};
    expect(()=>guard.canActivate(context as any)).toThrow('users:edit');
  });
  it('keeps API integer precision and strips import metadata',()=>{
    expect(apiRows({rows:[{id:'42',document_id:'42',source_record_sha256:'private'}],fields:[{name:'id',dataTypeID:20}]} as any)).toEqual([{id:42,fichaId:'42'}]);
    expect(()=>apiRows({rows:[{id:'9007199254740993'}],fields:[{name:'id',dataTypeID:20}]} as any)).toThrow('precision');
  });
  it('rejects unexpected SQL identifiers before sending a query',async()=>{
    const db={query:vi.fn()};
    await expect(insertIdentity(db as any,'users',{'email = null; --':'test'})).rejects.toThrow('Unapproved SQL column');
    expect(db.query).not.toHaveBeenCalled();
  });
});
