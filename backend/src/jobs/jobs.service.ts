import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PgBoss from 'pg-boss';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private boss: PgBoss;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.boss = new PgBoss(this.config.get<string>('DATABASE_URL')!);

    this.boss.on('error', (err) => this.logger.error('pg-boss error', err));

    await this.boss.start();
    this.logger.log('pg-boss iniciado');

    // Registrar workers
    await this.registerWorkers();

    // Cron: limpiar tokens revocados expirados (diario a las 3AM)
    await this.boss.schedule('cleanup-revoked-tokens', '0 3 * * *');
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }

  // ── Encolar jobs ────────────────────────────────────────────

  async queueEmail(payload: { to: string; subject: string; html: string }) {
    return this.boss.send('send-email', payload, { retryLimit: 3, retryDelay: 30 });
  }

  async queueFileProcessing(payload: { documentId: number; minioKey: string }) {
    return this.boss.send('process-file', payload, { retryLimit: 2 });
  }

  async queueSearchIndexing(payload: { type: 'content' | 'document'; id: number }) {
    return this.boss.send('index-search', payload, { retryLimit: 3 });
  }

  // ── Workers ─────────────────────────────────────────────────

  private async registerWorkers() {
    await this.boss.work('send-email', async (job) => {
      const { to, subject, html } = job.data as any;
      this.logger.log(`📧 Enviando email a: ${to} | Asunto: ${subject}`);
      // TODO: implementar con Nodemailer usando ConfigService
    });

    await this.boss.work('process-file', async (job) => {
      const { documentId, minioKey } = job.data as any;
      this.logger.log(`📄 Procesando archivo documentId=${documentId}`);
      // TODO: generación de thumbnails, extracción de metadata, etc.
    });

    await this.boss.work('index-search', async (job) => {
      const { type, id } = job.data as any;
      this.logger.log(`🔍 Indexando ${type} id=${id}`);
      // Los índices GIN de PostgreSQL se actualizan automáticamente con los triggers
      // Este job es para indexación en Elasticsearch cuando se implemente en Fase 3
    });

    await this.boss.work('cleanup-revoked-tokens', async () => {
      this.logger.log('🧹 Limpiando tokens revocados expirados');
      // TODO: DELETE FROM revoked_tokens WHERE expires_at < NOW() via PrismaService
    });
  }
}
