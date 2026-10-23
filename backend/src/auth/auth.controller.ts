import {
  Controller, Post, Body, Req, HttpCode, HttpStatus, Get, ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PostgresAuthService } from './postgres-auth.service';
import { PasswordRecoveryService } from './password-recovery.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-recovery.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { RegisterDto } from './dto/register.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { Public } from '../common/decorators/public.decorator';
import { AllowPending } from '../common/decorators/allow-pending.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private authService: PostgresAuthService,
    private recovery: PasswordRecoveryService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.recovery.request(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.recovery.reset(dto.token, dto.password);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens JWT' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Auto-registro público con email y contraseña' })
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar si un email ya existe en la plataforma' })
  checkEmail(@Body() body: ForgotPasswordDto) {
    return this.authService.checkEmail(body.email);
  }

  // ── Perfil ─────────────────────────────────────────────────────────────

  @AllowPending()
  @Post('complete-profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Completar datos de perfil tras el registro' })
  completeProfile(@Body() dto: CompleteProfileDto, @CurrentUser() user: any) {
    return this.authService.completeProfile(user.sub, dto);
  }

  // ── Tokens ─────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token con refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: obtener token con permisos de otro rol para pruebas' })
  impersonate(@Body() body: { roleId: number }, @CurrentUser() user: any) {
    if (user.role !== 'admin') throw new ForbiddenException('Solo administradores pueden simular roles');
    return this.authService.impersonateRole(user.sub, user.email, body.roleId);
  }

  @AllowPending()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión e invalidar tokens' })
  logout(@Body() dto: LogoutDto, @CurrentUser() user: any) {
    return this.authService.logout(user.sub, dto.refreshToken, user.jti, user.exp);
  }

  @AllowPending()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado' })
  me(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub);
  }
}
