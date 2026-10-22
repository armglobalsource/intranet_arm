import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private bucketDocs: Bucket;
  private bucketAvatars: Bucket;
  private supabase?: SupabaseClient;
  private readonly publicBucket: string;
  private readonly documentsBucket: string;

  /** true cuando no hay GCS configurado (desarrollo local) */
  private readonly useLocal: boolean;
  private readonly uploadsDir: string;
  private readonly backendUrl: string;

  constructor(private config: ConfigService) {
    const provider = config.get<string>('STORAGE', 'local');
    if (!['local', 'gcs', 'supabase'].includes(provider)) throw new Error('Proveedor STORAGE inválido');
    this.useLocal = provider === 'local';
    this.publicBucket = config.get('SUPABASE_BUCKET_PUBLIC', 'arm-public');
    this.documentsBucket = config.get('SUPABASE_BUCKET_DOCUMENTS', 'arm-documents');
    if (process.env.VERCEL && this.useLocal) {
      throw new Error('Vercel requiere almacenamiento externo. Configura STORAGE=supabase y sus credenciales.');
    }
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    this.backendUrl = config.get<string>('BACKEND_URL', 'http://localhost:3001');

    if (provider === 'supabase') {
      const url = config.get<string>('SUPABASE_URL');
      const key = config.get<string>('SUPABASE_SECRET_KEY');
      if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY para Storage');
      if (new URL(url).protocol !== 'https:') throw new Error('Supabase Storage requiere HTTPS');
      this.supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    } else if (!this.useLocal) {
      const keyFile  = config.get<string>('GCS_KEY_FILE');
      const projectId = config.get<string>('GCS_PROJECT_ID');
      const credentialsJson = config.get<string>('GCS_CREDENTIALS_JSON');
      let credentials: any;
      if (credentialsJson) {
        try { credentials = JSON.parse(credentialsJson); }
        catch { throw new Error('GCS_CREDENTIALS_JSON no tiene un formato válido'); }
      }
      this.storage = credentials
        ? new Storage({ projectId, credentials })
        : keyFile
        ? new Storage({ projectId, keyFilename: keyFile })
        : new Storage({ projectId });
    }
  }

  onModuleInit() {
    if (this.supabase) {
      this.logger.log('Storage Supabase configurado');
      return;
    }
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
    this.validateKey(key);
    if (this.supabase) {
      await this.uploadSupabase(this.publicBucket, key, buffer, mimeType);
      return this.supabase.storage.from(this.publicBucket).getPublicUrl(key).data.publicUrl;
    }
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
    this.validateKey(key);
    if (this.supabase) return this.uploadSupabase(this.documentsBucket, key, buffer, mimeType);
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
    this.validateKey(key);
    if (this.supabase) return this.uploadSupabase(this.publicBucket, key, buffer, mimeType);
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
    this.validateKey(key);
    if (this.supabase) {
      const { data, error } = await this.supabase.storage.from(bucket === 'documents' ? this.documentsBucket : this.publicBucket).createSignedUrl(key, expirySeconds);
      if (error || !data?.signedUrl) throw new Error('No se pudo generar el enlace del archivo');
      return data.signedUrl;
    }
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
    this.validateKey(key);
    if (this.supabase) {
      const { error } = await this.supabase.storage.from(bucket === 'documents' ? this.documentsBucket : this.publicBucket).remove([key]);
      if (error) throw new Error('No se pudo eliminar el archivo');
      return;
    }
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

  private validateKey(key: string) {
    if (!key || key.includes('\\') || key.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Ruta de archivo inválida');
    }
  }

  private async uploadSupabase(bucket: string, key: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase!.storage.from(bucket).upload(key, buffer, { contentType, upsert: false });
    if (error) throw new Error('No se pudo guardar el archivo en Supabase Storage');
  }
}
