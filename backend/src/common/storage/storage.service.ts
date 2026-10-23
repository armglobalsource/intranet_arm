import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Archivos de la aplicación. En Vercel siempre Supabase Storage
 * (STORAGE=supabase); en desarrollo puede usarse el disco local (STORAGE=local).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabase?: SupabaseClient;
  private readonly publicBucket: string;
  private readonly documentsBucket: string;
  private readonly uploadsDir: string;
  private readonly backendUrl: string;

  constructor(config: ConfigService) {
    const provider = config.get<string>('STORAGE', 'local');
    if (!['local', 'supabase'].includes(provider)) throw new Error('Proveedor STORAGE inválido');
    if (process.env.VERCEL && provider === 'local') {
      throw new Error('Vercel requiere almacenamiento externo. Configura STORAGE=supabase y sus credenciales.');
    }
    this.publicBucket = config.get('SUPABASE_BUCKET_PUBLIC', 'arm-public');
    this.documentsBucket = config.get('SUPABASE_BUCKET_DOCUMENTS', 'arm-documents');
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    this.backendUrl = config.get<string>('BACKEND_URL', 'http://localhost:3001');

    if (provider === 'supabase') {
      const url = config.get<string>('SUPABASE_URL');
      const key = config.get<string>('SUPABASE_SECRET_KEY');
      if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY para Storage');
      if (new URL(url).protocol !== 'https:') throw new Error('Supabase Storage requiere HTTPS');
      this.supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    }
  }

  onModuleInit() {
    if (this.supabase) {
      this.logger.log('Storage Supabase configurado');
      return;
    }
    fs.mkdirSync(path.join(this.uploadsDir, 'team-logos'), { recursive: true });
    this.logger.log(`Storage LOCAL — sirviendo archivos desde ${this.uploadsDir}`);
  }

  // ── Upload público (team logos, avatares, etc.) ────────────────

  async uploadPublic(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    this.validateKey(key);
    if (this.supabase) {
      await this.uploadSupabase(this.publicBucket, key, buffer, mimeType);
      return this.supabase.storage.from(this.publicBucket).getPublicUrl(key).data.publicUrl;
    }
    this.writeLocal(key, buffer);
    return `${this.backendUrl}/uploads/${key}`;
  }

  // ── Documentos (siempre privados) ─────────────────────────────

  async uploadDocument(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    this.validateKey(key);
    if (this.supabase) return this.uploadSupabase(this.documentsBucket, key, buffer, mimeType);
    this.writeLocal(key, buffer);
  }

  async uploadAvatar(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    this.validateKey(key);
    if (this.supabase) return this.uploadSupabase(this.publicBucket, key, buffer, mimeType);
    this.writeLocal(key, buffer);
  }

  async getPresignedUrl(bucket: 'documents' | 'avatars', key: string, expirySeconds = 3600): Promise<string> {
    this.validateKey(key);
    if (!this.supabase) return `${this.backendUrl}/uploads/${key}`;
    const { data, error } = await this.supabase.storage.from(this.bucketName(bucket)).createSignedUrl(key, expirySeconds);
    if (error || !data?.signedUrl) throw new Error('No se pudo generar el enlace del archivo');
    return data.signedUrl;
  }

  async deleteObject(bucket: 'documents' | 'avatars', key: string): Promise<void> {
    this.validateKey(key);
    if (this.supabase) {
      const { error } = await this.supabase.storage.from(this.bucketName(bucket)).remove([key]);
      if (error) throw new Error('No se pudo eliminar el archivo');
      return;
    }
    const filePath = path.join(this.uploadsDir, key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  private bucketName(bucket: 'documents' | 'avatars') {
    return bucket === 'documents' ? this.documentsBucket : this.publicBucket;
  }

  private writeLocal(key: string, buffer: Buffer) {
    const filePath = path.join(this.uploadsDir, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
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

  async createUploadUrl(key: string): Promise<string> {
    this.validateKey(key);
    if (!this.supabase) throw new Error('Las cargas directas requieren Supabase Storage');
    const { data, error } = await this.supabase.storage.from('arm-uploads').createSignedUploadUrl(key, { upsert: false });
    if (error || !data) throw new Error('No se pudo autorizar la carga');
    return data.signedUrl;
  }

  async readUpload(key: string, expectedSize: number): Promise<Buffer> {
    this.validateKey(key);
    if (!this.supabase) throw new Error('Las cargas directas requieren Supabase Storage');
    const { data, error } = await this.supabase.storage.from('arm-uploads').download(key);
    if (error || !data || data.size !== expectedSize || data.size > 10 * 1024 * 1024) {
      throw new Error('El archivo cargado no coincide con la carga autorizada');
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async discardUpload(key: string): Promise<void> {
    this.validateKey(key);
    const { error } = await this.supabase!.storage.from('arm-uploads').remove([key]);
    if (error) this.logger.warn('No se pudo limpiar una carga temporal ya procesada');
  }
}
