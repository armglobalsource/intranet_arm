import {
  Controller, Post, Body, Req, Res, HttpCode, HttpStatus, Get, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { RegisterDto } from './dto/register.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

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
  checkEmail(@Body() body: { email: string }) {
    return this.authService.checkEmail(body.email);
  }

  // ── Google OAuth ────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Iniciar flujo OAuth con Google' })
  googleLogin() {
    // Passport redirige a Google automáticamente
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  async googleCallback(@Req() req: any, @Res() res: Response) {
    // FRONTEND_URL puede ser CSV ("https://a.com,https://b.com") — usar solo la primera
    const frontendUrl = (this.config.get<string>('FRONTEND_URL', 'http://localhost:3000'))
      .split(',')[0].trim();
    try {
      const result = await this.authService.googleAuth(
        req.user,
        req.ip,
        req.headers['user-agent'],
      );
      const params = new URLSearchParams({
        access:           result.accessToken,
        refresh:          result.refreshToken,
        needs_completion: result.needsProfileCompletion ? '1' : '0',
      });
      const target = result.needsProfileCompletion
        ? `${frontendUrl}/auth/complete-profile?${params}`
        : `${frontendUrl}/auth/google-callback?${params}`;
      res.redirect(target);
    } catch {
      res.redirect(`${frontendUrl}/auth/login?error=oauth_failed`);
    }
  }

  // ── Perfil ─────────────────────────────────────────────────────────────

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

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión e invalidar tokens' })
  logout(@Body() dto: LogoutDto, @CurrentUser() user: any) {
    return this.authService.logout(user.sub, dto.refreshToken, user.jti, user.exp);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado' })
  me(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub);
  }
}
