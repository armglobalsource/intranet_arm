import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private bucketDocs: Bucket;
  private bucketAvatars: Bucket;

  /** true cuando no hay GCS configurado (desarrollo local) */
  private readonly useLocal: boolean;
  private readonly uploadsDir: string;
  private readonly backendUrl: string;

  constructor(private config: ConfigService) {
    this.useLocal = config.get<string>('STORAGE', 'local') === 'local';
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    this.backendUrl = config.get<string>('BACKEND_URL', 'http://localhost:3001');

    if (!this.useLocal) {
      const keyFile  = config.get<string>('GCS_KEY_FILE');
      const projectId = config.get<string>('GCS_PROJECT_ID');
      this.storage = keyFile
        ? new Storage({ projectId, keyFilename: keyFile })
        : new Storage({ projectId });
    }
  }

  onModuleInit() {
    if (this.useLocal) {
      fs.mkdirSync(path.join(this.uploadsDir, 'team-logos'), { recursive: true });
      this.logger.log(`Storage LOCAL — sirviendo archivos desde ${this.uploadsDir}`);
      return;
    }
    this.bucketDocs    = this.storage.bucket(this.config.get('GCS_BUCKET_DOCUMENTS', 'intranet-documents'));
    this.bucketAvatars = this.storage.bucket(this.config.get('GCS_BUCKET_AVATARS',   'intranet-avatars'));
    this.logger.log(`Storage GCS — docs: ${this.bucketDocs.name}, avatars: ${this.bucketAvatars.name}`);
  }

  // ── Upload público (team logos, avatares, etc.) ────────────────

  async uploadPublic(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (this.useLocal) {
      const filePath = path.join(this.uploadsDir, key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);
      return `${this.backendUrl}/uploads/${key}`;
    }

    // GCS
    const file = this.bucketAvatars.file(key);
    await file.save(buffer, { metadata: { contentType: mimeType }, resumable: false });
    try {
      await file.makePublic();
      return `https://storage.googleapis.com/${this.bucketAvatars.name}/${key}`;
    } catch {
      this.logger.warn(`makePublic falló para ${key}, usando signed URL`);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 6 * 24 * 60 * 60 * 1000,
        version: 'v4',
      });
      return url;
    }
  }

  // ── Documentos (siempre privados) ─────────────────────────────

  async uploadDocument(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (this.useLocal) {
      const filePath = path.join(this.uploadsDir, key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);
      return;
    }
    await this.bucketDocs.file(key).save(buffer, {
      metadata: { contentType: mimeType },
      resumable: false,
    });
  }

  async uploadAvatar(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (this.useLocal) {
      const filePath = path.join(this.uploadsDir, key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);
      return;
    }
    await this.bucketAvatars.file(key).save(buffer, {
      metadata: { contentType: mimeType },
      resumable: false,
    });
  }

  async getPresignedUrl(bucket: 'documents' | 'avatars', key: string, expirySeconds = 3600): Promise<string> {
    if (this.useLocal) {
      return `${this.backendUrl}/uploads/${key}`;
    }
    const file = bucket === 'documents'
      ? this.bucketDocs.file(key)
      : this.bucketAvatars.file(key);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expirySeconds * 1000,
      version: 'v4',
    });
    return url;
  }

  async deleteObject(bucket: 'documents' | 'avatars', key: string): Promise<void> {
    if (this.useLocal) {
      const filePath = path.join(this.uploadsDir, key);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }
    const file = bucket === 'documents'
      ? this.bucketDocs.file(key)
      : this.bucketAvatars.file(key);
    await file.delete({ ignoreNotFound: true });
  }
}
