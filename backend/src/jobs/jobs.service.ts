import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(private fb: FirebaseService) {}

  onModuleInit() {
    this.logger.log('JobsService iniciado (Firestore mode)');
    // Limpieza lazy de tokens en cada arranque (no bloquea el inicio)
    this.cleanupExpiredTokens().catch((e) => this.logger.warn('cleanup error', e));
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────

  async queueEmail(payload: { to: string; subject: string; html: string }) {
    // Fire-and-forget: en producción reemplazar con Cloud Tasks o Nodemailer directo
    this.logger.log(`📧 Email encolado para: ${payload.to}`);
  }

  async queueFileProcessing(payload: { documentId: number; minioKey: string }) {
    this.logger.log(`📄 Procesando archivo documentId=${payload.documentId}`);
  }

  async queueSearchIndexing(payload: { type: 'content' | 'document'; id: number }) {
    this.logger.log(`🔍 Indexando ${payload.type} id=${payload.id}`);
  }

  // ── Limpieza de tokens expirados ──────────────────────────────────────────

  private async cleanupExpiredTokens() {
    const now = new Date();

    const [revoked, refreshed] = await Promise.all([
      this.fb.db.collection('revoked_tokens')
        .where('expiresAt', '<', now).limit(100).get(),
      this.fb.db.collection('refresh_tokens')
        .where('expiresAt', '<', now).limit(100).get(),
    ]);

    if (revoked.empty && refreshed.empty) return;

    const batch = this.fb.db.batch();
    revoked.docs.forEach((d)  => batch.delete(d.ref));
    refreshed.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    this.logger.log(`🧹 Tokens eliminados: ${revoked.size + refreshed.size}`);
  }
}
