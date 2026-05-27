import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private static readonly log = new Logger(GoogleStrategy.name);

  constructor(config: ConfigService) {
    const clientID     = config.get<string>('GOOGLE_CLIENT_ID')     || 'PLACEHOLDER_CLIENT_ID';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || 'PLACEHOLDER_CLIENT_SECRET';
    const backendUrl   = config.get<string>('BACKEND_URL', 'http://localhost:3001');

    if (!config.get('GOOGLE_CLIENT_SECRET')) {
      GoogleStrategy.log.warn(
        'GOOGLE_CLIENT_SECRET no configurado — Google OAuth deshabilitado. ' +
        'Agrega GOOGLE_CLIENT_SECRET al servicio de Cloud Run para habilitarlo.',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL: `${backendUrl}/api/v1/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: VerifyCallback) {
    const { name, emails, photos } = profile;
    done(null, {
      email:     emails[0].value,
      firstName: name.givenName  ?? '',
      lastName:  name.familyName ?? '',
      avatarUrl: photos?.[0]?.value ?? null,
    });
  }
}
