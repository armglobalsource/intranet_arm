import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResendMailerService {
  constructor(private config: ConfigService) {}

  settings() {
    const key = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM_EMAIL');
    let origin: URL;
    try {
      origin = new URL(this.config.get<string>('FRONTEND_URL') ?? '');
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error();
    } catch {
      throw new ServiceUnavailableException('La recuperación no está disponible por el momento. Inténtalo más tarde.');
    }
    if (!key || !from || !from.includes('@') || /[\r\n]/.test(from)) {
      throw new ServiceUnavailableException('La recuperación no está disponible por el momento. Inténtalo más tarde.');
    }
    return { key, from, origin: origin.origin };
  }

  async sendPasswordReset(to: string, token: string, requestId: string) {
    const { key, from, origin } = this.settings();
    // Fragment is never sent to the web server or included in referrer headers.
    const link = `${origin}/auth/reset-password#token=${token}`;
    const safeLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `password-reset/${requestId}` },
      body: JSON.stringify({
        from, to: [to], subject: 'Recupera tu acceso a Ecosistema ARM',
        text: `Hola,\n\nRecibimos una solicitud para cambiar tu contraseña de Ecosistema ARM.\n\nAbre este enlace para elegir una nueva: ${link}\n\nEl enlace vence en 15 minutos y solo puede usarse una vez. Si no lo solicitaste, puedes ignorar este correo; tu contraseña no cambiará.\n\nARM Global`,
        html: `<div style="background:#f5f5f2;padding:32px 16px;font-family:Arial,sans-serif;color:#182421"><div style="max-width:480px;margin:auto;background:white;border:1px solid #e3e6e2;border-radius:20px;padding:32px"><p style="font-size:24px;letter-spacing:-1px"><strong>arm global</strong></p><p style="color:#52655b;font-size:12px;letter-spacing:2px">ECOSISTEMA ARM</p><h1 style="font-size:26px;line-height:1.2">Volvamos a conectar.</h1><p style="line-height:1.7">Recibimos una solicitud para restablecer tu contraseña. Elige una nueva para volver a tu comunidad.</p><p style="margin:28px 0"><a href="${safeLink}" style="background:#173e32;color:white;padding:15px 22px;border-radius:10px;text-decoration:none;display:inline-block">Crear nueva contraseña</a></p><p style="font-size:14px;line-height:1.7;color:#52655b">Este enlace vence en <strong>15 minutos</strong> y solo puede usarse una vez. Si no lo solicitaste, ignora este correo. Tu contraseña no cambiará.</p><p style="font-size:12px;line-height:1.7;color:#52655b">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${safeLink}" style="color:#173e32;word-break:break-all">${safeLink}</a></p></div></div>`,
      }),
    });
    // Never include the provider body, recipient, link or API key in errors/logs.
    if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
    const data = await response.json() as { id?: string };
    if (!data.id) throw new Error('Resend did not acknowledge the email');
  }
}
