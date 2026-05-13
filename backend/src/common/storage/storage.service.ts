import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private bucketDocs: Bucket;
  private bucketAvatars: Bucket;

  constructor(private config: ConfigService) {
    const keyFile = config.get<string>('GCS_KEY_FILE');
    const projectId = config.get<string>('GCS_PROJECT_ID');

    // En Cloud Run con Workload Identity no se necesita keyFile
    this.storage = keyFile
      ? new Storage({ projectId, keyFilename: keyFile })
      : new Storage({ projectId });
  }

  onModuleInit() {
    this.bucketDocs    = this.storage.bucket(this.config.get('GCS_BUCKET_DOCUMENTS', 'intranet-documents'));
    this.bucketAvatars = this.storage.bucket(this.config.get('GCS_BUCKET_AVATARS', 'intranet-avatars'));
    this.logger.log(`Storage inicializado — docs: ${this.bucketDocs.name}, avatars: ${this.bucketAvatars.name}`);
  }

  async uploadDocument(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.bucketDocs.file(key).save(buffer, {
      metadata: { contentType: mimeType },
      resumable: false,
    });
  }

  async uploadAvatar(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.bucketAvatars.file(key).save(buffer, {
      metadata: { contentType: mimeType },
      resumable: false,
    });
  }

  async getPresignedUrl(bucket: 'documents' | 'avatars', key: string, expirySeconds = 3600): Promise<string> {
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
    const file = bucket === 'documents'
      ? this.bucketDocs.file(key)
      : this.bucketAvatars.file(key);
    await file.delete({ ignoreNotFound: true });
  }
}
