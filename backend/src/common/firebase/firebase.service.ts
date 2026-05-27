import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  db: admin.firestore.Firestore;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (!admin.apps.length) {
      const projectId  = this.config.get<string>('FIREBASE_PROJECT_ID', 'intranet-arm');
      const keyFileEnv = this.config.get<string>('FIREBASE_KEY_FILE', '');
      const keyFilePath = keyFileEnv ? path.resolve(keyFileEnv) : '';
      const hasKeyFile  = keyFilePath && fs.existsSync(keyFilePath);

      this.logger.log(
        `Firebase init — projectId=${projectId} ` +
        `keyFile=${hasKeyFile ? keyFilePath : 'N/A (ADC)'}`
      );

      // Cloud Run / GCP → usa Application Default Credentials automáticamente
      // Local dev       → usa el service-account.json
      const credential = hasKeyFile
        ? admin.credential.cert(keyFilePath)
        : admin.credential.applicationDefault();

      admin.initializeApp({ credential, projectId });
      this.logger.log(hasKeyFile ? 'Firestore con service-account.json' : 'Firestore con ADC');
    }
    this.db = admin.firestore();
    this.logger.log('Firestore conectado');
  }

  // ── Auto-increment ID (reemplaza SERIAL de PostgreSQL) ─────────────────────

  async nextId(collection: string): Promise<number> {
    const ref = this.db.collection('_counters').doc(collection);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const next = snap.exists ? (snap.data()!.next as number) : 1;
      tx.set(ref, { next: next + 1 });
      return next;
    });
  }

  // ── Helpers de lectura ──────────────────────────────────────────────────────

  /** Convierte DocumentSnapshot → objeto plano (preserva number ID) */
  toObj(snap: admin.firestore.DocumentSnapshot): any {
    if (!snap.exists) return null;
    const data = snap.data()!;
    // fichaId siempre viene del ID real del documento (nunca del campo almacenado)
    return { ...this.convertTimestamps(data), fichaId: snap.id };
  }

  /** Convierte QueryDocumentSnapshot[] → array de objetos */
  toDocs(snaps: admin.firestore.QuerySnapshot): any[] {
    return snaps.docs.map((d) => ({ ...this.convertTimestamps(d.data()), fichaId: d.id }));
  }

  private convertTimestamps(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof admin.firestore.Timestamp) return obj.toDate();
    if (Array.isArray(obj)) return obj.map((item) => this.convertTimestamps(item));
    if (typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, this.convertTimestamps(v)]),
      );
    }
    return obj;
  }

  // ── Timestamps ─────────────────────────────────────────────────────────────

  now() { return admin.firestore.FieldValue.serverTimestamp(); }
  ts(date: Date) { return admin.firestore.Timestamp.fromDate(date); }
}
