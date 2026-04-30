import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private readonly bucketDocs: string;
  private readonly bucketAvatars: string;

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint:  config.get('MINIO_ENDPOINT', 'localhost'),
      port:      parseInt(config.get('MINIO_PORT', '9000')),
      useSSL:    config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.get('MINIO_ACCESS_KEY', ''),
      secretKey: config.get('MINIO_SECRET_KEY', ''),
    });
    this.bucketDocs    = config.get('MINIO_BUCKET_DOCUMENTS', 'intranet-documents');
    this.bucketAvatars = config.get('MINIO_BUCKET_AVATARS', 'intranet-avatars');
  }

  async onModuleInit() {
    await this.ensureBucket(this.bucketDocs);
    await this.ensureBucket(this.bucketAvatars);
  }

  private async ensureBucket(name: string) {
    const exists = await this.client.bucketExists(name);
    if (!exists) {
      await this.client.makeBucket(name, 'us-east-1');
      this.logger.log(`Bucket creado: ${name}`);
    }
  }

  async uploadDocument(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucketDocs, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async uploadAvatar(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucketAvatars, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async getPresignedUrl(bucket: 'documents' | 'avatars', key: string, expirySeconds = 3600): Promise<string> {
    const bucketName = bucket === 'documents' ? this.bucketDocs : this.bucketAvatars;
    return this.client.presignedGetObject(bucketName, key, expirySeconds);
  }

  async deleteObject(bucket: 'documents' | 'avatars', key: string): Promise<void> {
    const bucketName = bucket === 'documents' ? this.bucketDocs : this.bucketAvatars;
    await this.client.removeObject(bucketName, key);
  }
}
