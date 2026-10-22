import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { DatabaseModule } from './common/database/database.module';
import { StorageModule } from './common/storage/storage.module';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { RolesController } from './roles/roles.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { RolesService } from './roles/roles.service';
import { NotificationsService } from './notifications/notifications.service';
import { PostgresAuthService } from './auth/postgres-auth.service';
import { PostgresUsersService } from './users/postgres-users.service';
import { PostgresRolesService } from './roles/postgres-roles.service';
import { PostgresNotificationsService } from './notifications/postgres-notifications.service';
import { PostgresJwtStrategy } from './auth/strategies/postgres-jwt.strategy';
import { GoogleStrategy } from './auth/strategies/google.strategy';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PendingAccountGuard } from './common/guards/pending-account.guard';
import { PostgresUsersPermissionsGuard } from './auth/guards/postgres-users-permissions.guard';
import { postgresDomainControllers,postgresDomainProviders } from './postgres-domain.providers';

// Independent application root: no Firebase providers or legacy domain modules.
// Use only for migration validation until all domain services have SQL repositories.
@Module({
  imports:[
    ConfigModule.forRoot({isGlobal:true,envFilePath:['.env.supabase','.env'],validationSchema:Joi.object({
      DATABASE_URL:Joi.string().uri({scheme:['postgres','postgresql']}).required(),
      JWT_SECRET:Joi.string().min(32).required(),
      JWT_ACCESS_TTL:Joi.number().integer().min(1).default(900),
      JWT_REFRESH_TTL:Joi.number().integer().min(1).default(28800),
    }).unknown(true)}),
    DatabaseModule,StorageModule,PassportModule,
    ThrottlerModule.forRoot([{ttl:60000,limit:100}]),
    JwtModule.registerAsync({inject:[ConfigService],useFactory:(config:ConfigService)=>({secret:config.get<string>('JWT_SECRET')})}),
  ],
  controllers:[AuthController,UsersController,RolesController,NotificationsController,...postgresDomainControllers],
  providers:[
    ...postgresDomainProviders,
    PostgresAuthService,PostgresUsersService,PostgresRolesService,PostgresNotificationsService,
    {provide:AuthService,useExisting:PostgresAuthService},
    {provide:UsersService,useExisting:PostgresUsersService},
    {provide:RolesService,useExisting:PostgresRolesService},
    {provide:NotificationsService,useExisting:PostgresNotificationsService},
    PostgresJwtStrategy,GoogleStrategy,
    {provide:APP_GUARD,useClass:JwtAuthGuard},
    {provide:APP_GUARD,useClass:PendingAccountGuard},
    {provide:APP_GUARD,useClass:PostgresUsersPermissionsGuard},
    {provide:APP_GUARD,useClass:ThrottlerGuard},
  ],
})
export class PostgresIdentityModule {}
