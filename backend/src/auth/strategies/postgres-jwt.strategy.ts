import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PostgresAuthService } from '../postgres-auth.service';

@Injectable()
export class PostgresJwtStrategy extends PassportStrategy(Strategy) {
  constructor(config:ConfigService,private auth:PostgresAuthService) {
    super({jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken(),ignoreExpiration:false,secretOrKey:config.get<string>('JWT_SECRET')});
  }
  async validate(payload:any) {
    if(!Number.isSafeInteger(payload.sub)||typeof payload.jti!=='string'||await this.auth.isTokenRevoked(payload.jti)) throw new UnauthorizedException('Token inválido o revocado');
    let me:any;
    try {me=await this.auth.getMe(payload.sub);} catch(error) {
      if((error as any)?.getStatus?.()===404) throw new UnauthorizedException('Cuenta no disponible');
      throw error;
    }
    if(!['active','pending'].includes(me.status)) throw new UnauthorizedException('Cuenta no activa');
    let role=await this.auth.getRole(me.roleId??0);
    if(payload.impersonating) {
      if(me.status!=='active'||(me.role?.name!=='admin'&&!me.permissions.includes('*'))) throw new UnauthorizedException('Simulación revocada');
      role=await this.auth.getRole(payload.roleId);
      if(!role||role.isActive===false||role.name==='admin'||(role.permissions??[]).includes('*')) throw new UnauthorizedException('Simulación inválida');
    }
    return {...payload,email:me.email,status:me.status,campusId:me.campusId??null,role:role?.isActive===false?'user':role?.name??'user',roleId:role?.id??0,permissions:role?.isActive===false?[]:role?.permissions??[]};
  }
}
