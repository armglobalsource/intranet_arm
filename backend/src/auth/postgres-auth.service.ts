import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, SqlConnection } from '../common/database/identity-sql';
import { PostgresUsersService } from '../users/postgres-users.service';
import { PostgresNotificationsService } from '../notifications/postgres-notifications.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class PostgresAuthService {
  private logger=new Logger(PostgresAuthService.name);
  constructor(private db: DatabaseService,private users: PostgresUsersService,private jwt: JwtService,private config: ConfigService,private notifications: PostgresNotificationsService) {}
  private active(user:any) {
    if(user.status==='rejected') throw new ForbiddenException('Tu solicitud de registro fue rechazada.');
    if(!['active','pending'].includes(user.status)) throw new UnauthorizedException('Cuenta suspendida o inactiva');
  }
  private hash(token:string) { return createHash('sha256').update(token).digest('hex'); }
  async getRole(id:number,db:SqlConnection=this.db) {
    return apiRows(await db.query('SELECT id,name,permissions,"isActive" FROM arm_app.roles WHERE id=$1',[id]))[0]??null;
  }
  private async issue(userId:number,db:SqlConnection,ipAddress?:string,userAgent?:string) {
    const user=await this.users.rawById(userId,db);
    this.active(user);
    const role=await this.getRole(user.roleId??0,db);
    const permissions=role?.isActive===false?[]:role?.permissions??[];
    const accessTtl=this.config.get<number>('JWT_ACCESS_TTL',900);
    const refreshTtl=this.config.get<number>('JWT_REFRESH_TTL',28800);
    const payload={sub:user.id,authVersion:user.authVersion??0,email:user.email,role:role?.isActive===false?'user':role?.name??'user',roleId:role?.id??0,permissions,jti:randomUUID(),campusId:user.campusId??null};
    const accessToken=this.jwt.sign(payload,{expiresIn:`${accessTtl}s`});
    const refreshToken=randomUUID();
    await db.query(`INSERT INTO arm_app.refresh_tokens(document_id,"userId","tokenHash","expiresAt","ipAddress","userAgent","createdAt") VALUES ($1,$2,$3,$4,$5,$6,now())`,[randomUUID(),user.id,this.hash(refreshToken),new Date(Date.now()+refreshTtl*1000),ipAddress??null,userAgent??null]);
    return {accessToken,refreshToken,expiresIn:accessTtl,permissions};
  }
  private async session(user:any,ip?:string,agent?:string) {
    this.active(user);
    await this.users.updateLastLogin(user.id);
    const {permissions,...tokens}=await this.db.transaction(async client=>{
      const current=(await client.query('SELECT "passwordHash" FROM arm_app.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
      if(!current || current.passwordHash!==user.passwordHash) throw new UnauthorizedException('La contraseña cambió. Inicia sesión nuevamente.');
      return this.issue(user.id,client,ip,agent);
    });
    const safe=await this.users.findOne(user.id);
    return {user:{...safe,permissions},...tokens,needsProfileCompletion:!safe.onboardingCompletedAt};
  }
  async login(dto:LoginDto,ip?:string,agent?:string) {
    const user=await this.users.findByEmail(dto.email);
    if(!user?.passwordHash||!await bcrypt.compare(dto.password,user.passwordHash)) throw new UnauthorizedException('Credenciales inválidas');
    return this.session(user,ip,agent);
  }
  async refresh(token:string) {
    if(typeof token!=='string'||!token) throw new UnauthorizedException('Refresh token inválido o expirado');
    return this.db.transaction(async client=>{
      const owner=(await client.query('SELECT "userId" FROM arm_app.refresh_tokens WHERE "tokenHash"=$1',[this.hash(token)])).rows[0];
      if(!owner) throw new UnauthorizedException('Refresh token inválido o expirado');
      await client.query('SELECT id FROM arm_app.users WHERE id=$1 FOR UPDATE',[owner.userId]);
      // Lock user before token, matching recovery. A refresh racing a password
      // reset either commits first and is revoked, or sees a revoked token.
      const result=apiRows(await client.query(`SELECT * FROM arm_app.refresh_tokens WHERE "tokenHash"=$1 FOR UPDATE`,[this.hash(token)]));
      const stored=result[0];
      if(!stored||stored.revokedAt||new Date(stored.expiresAt).getTime()<=Date.now()) throw new UnauthorizedException('Refresh token inválido o expirado');
      const {permissions,...tokens}=await this.issue(stored.userId,client);
      await client.query('UPDATE arm_app.refresh_tokens SET "revokedAt"=now() WHERE id=$1',[stored.id]);
      const safe=await this.users.findOne(stored.userId,client);
      return {user:{...safe,permissions},...tokens};
    });
  }
  async logout(userId:number,token:string,jti:string,exp:number) {
    if(!jti||!Number.isFinite(exp)) throw new UnauthorizedException('Token inválido');
    await this.db.transaction(async client=>{
      await client.query('UPDATE arm_app.refresh_tokens SET "revokedAt"=now() WHERE "userId"=$1 AND "tokenHash"=$2',[userId,this.hash(token)]);
      await client.query('INSERT INTO arm_app.revoked_tokens(jti,"expiresAt") VALUES($1,$2) ON CONFLICT(jti) DO NOTHING',[jti,new Date(exp*1000)]);
    });
  }
  async isTokenRevoked(jti:string) {
    return ((await this.db.query('SELECT 1 FROM arm_app.revoked_tokens WHERE jti=$1 AND "expiresAt">now()',[jti])).rowCount??0)>0;
  }
  async register(dto:RegisterDto,ip?:string,agent?:string) {
    let user=await this.users.findByEmail(dto.email);
    if(user) {
      throw new ConflictException('Este correo ya tiene una cuenta. Inicia sesión o usa "Olvidé mi contraseña" para recuperar tu acceso.');
    } else {
      user=await this.users.selfRegister(dto);
      await this.notifyRegistration(dto.email,dto.firstName,dto.lastName);
    }
    return this.session(user,ip,agent);
  }
  private async notifyRegistration(email:string,first:string,last:string) {
    await this.notifications.createForPermission('users:edit',{title:`Nuevo usuario registrado: ${first} ${last}`,body:`${email} se registró y está pendiente de tu aprobación.`,link:'/dashboard/directorio/personas?status=pending',channel:'in_app'}).catch(()=>this.logger.warn('No se pudo crear notificación de registro'));
  }
  async getMe(id:number) {
    const user=await this.users.findOne(id);
    const role=await this.getRole(user.roleId??0);
    return {...user,permissions:role?.isActive===false?[]:role?.permissions??[]};
  }
  async checkEmail(email:string) {
    const user=await this.users.findByEmail(email);
    if(!user) return {exists:false};
    return {exists:true};
  }
  async completeProfile(id:number,dto:CompleteProfileDto) {
    const update:UpdateUserDto={};
    for(const key of ['firstName','lastName','gender','phone','birthDate','password','preferredName','phoneCountryCode','campusId','referralChannel','referredByName','servingStatus','memberSince','interestAreas','otherAreaText'] as const) if(dto[key]!==undefined) (update as any)[key]=dto[key];
    await this.users.update(id,update);
    return {user:await this.users.markOnboardingComplete(id,!!dto.consentAccepted)};
  }
  async impersonateRole(userId:number,email:string,roleId:number) {
    const me=await this.getMe(userId);
    this.active(me);
    if(me.role?.name!=='admin'&&!me.permissions.includes('*')) throw new ForbiddenException();
    const role=await this.getRole(roleId);
    if(!role||role.isActive===false||role.name==='admin'||(role.permissions??[]).includes('*')) throw new ForbiddenException('Rol no disponible para simulación');
    const permissions=role.permissions??[];
    const accessToken=this.jwt.sign({sub:userId,authVersion:me.authVersion??0,email,role:role.name,roleId,permissions,jti:randomUUID(),campusId:me.campusId??null,firstName:me.firstName,lastName:me.lastName,impersonating:true},{expiresIn:'4h'});
    return {accessToken,roleName:role.name,permissions};
  }
}
