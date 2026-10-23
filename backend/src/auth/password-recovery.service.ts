import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../common/database/database.service';
import { apiRows } from '../common/database/identity-sql';
import { ResendMailerService } from './resend-mailer.service';

export const RECOVERY_MESSAGE = 'Si el correo corresponde a una cuenta disponible, recibirás un enlace para crear tu contraseña. Revisa también spam.';
const invalidLink = () => new BadRequestException('El enlace venció o ya fue utilizado. Solicita uno nuevo.');

@Injectable()
export class PasswordRecoveryService {
  private logger = new Logger(PasswordRecoveryService.name);
  constructor(private db: DatabaseService, private mailer: ResendMailerService) {}
  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }

  async request(email: string) {
    // Missing configuration produces the same response for every address.
    this.mailer.settings();
    const normalized = email.trim().toLowerCase();
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hash(token);
    const recipient = await this.db.transaction(async client => {
      const user = apiRows(await client.query(`SELECT id,email,"authVersion" FROM arm_app.users
        WHERE lower(btrim(email))=$1 AND status IN ('active','pending') FOR UPDATE`, [normalized]))[0];
      if (!user) return null;
      // Shared across all Vercel instances. A new request does not invalidate an
      // already delivered link, so requests cannot lock the owner out.
      const recent = await client.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE "createdAt">now()-interval '1 minute')::int AS minute
        FROM arm_app.password_reset_tokens WHERE "userId"=$1 AND "createdAt">now()-interval '1 hour'`, [user.id]);
      if (recent.rows[0].total >= 5 || recent.rows[0].minute > 0) return null;
      await client.query('DELETE FROM arm_app.password_reset_tokens WHERE "userId"=$1 AND "createdAt"<now()-interval \'1 day\'', [user.id]);
      await client.query(`INSERT INTO arm_app.password_reset_tokens("tokenHash","userId",email,"authVersion") VALUES($1,$2,$3,$4)`, [tokenHash, user.id, normalized, user.authVersion]);
      return user.email as string;
    });
    if (recipient) {
      try { await this.mailer.sendPasswordReset(recipient, token, randomUUID()); }
      catch {
        await this.db.query('UPDATE arm_app.password_reset_tokens SET "usedAt"=now() WHERE "tokenHash"=$1', [tokenHash]);
        this.logger.error('Resend no confirmó el correo de recuperación. Revisa la configuración y los registros del proveedor.');
      }
    }
    return { message: RECOVERY_MESSAGE };
  }

  async reset(token: string, password: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw invalidLink();
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Usa al menos 12 caracteres y un máximo de 72 bytes para tu contraseña.');
    const tokenHash = this.hash(token);
    const found = await this.db.query('SELECT "userId" FROM arm_app.password_reset_tokens WHERE "tokenHash"=$1 AND "usedAt" IS NULL AND "expiresAt">now()', [tokenHash]);
    if (!found.rowCount) throw invalidLink();
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.transaction(async client => {
      // Same lock order as login/refresh: user, then tokens.
      const user = (await client.query('SELECT id,email,status,"authVersion" FROM arm_app.users WHERE id=$1 FOR UPDATE', [found.rows[0].userId])).rows[0];
      if (!user || !['active','pending'].includes(user.status)) throw invalidLink();
      const consumed = await client.query(`UPDATE arm_app.password_reset_tokens SET "usedAt"=now()
        WHERE "tokenHash"=$1 AND "userId"=$2 AND "usedAt" IS NULL AND "expiresAt">now()
        AND email=lower(btrim($3)) AND "authVersion"=$4 RETURNING "userId"`, [tokenHash, user.id, user.email, user.authVersion]);
      if (!consumed.rowCount) throw invalidLink();
      await client.query('UPDATE arm_app.users SET "passwordHash"=$2,"authVersion"="authVersion"+1,"updatedAt"=now() WHERE id=$1', [user.id, passwordHash]);
      await client.query('UPDATE arm_app.password_reset_tokens SET "usedAt"=now() WHERE "userId"=$1 AND "usedAt" IS NULL', [user.id]);
      await client.query('UPDATE arm_app.refresh_tokens SET "revokedAt"=now() WHERE "userId"=$1 AND "revokedAt" IS NULL', [user.id]);
    });
    return { message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' };
  }
}
