import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

const KEY = 'reporte_semanal.destinatarios';
/** La tabla arm_app.app_settings aún no existe (migración app-settings.sql pendiente). */
const missingTable = (err: unknown) => (err as { code?: string })?.code === '42P01';

/** Destinatarios del reporte semanal, compartidos por quienes lo envían. */
@Injectable()
export class WeeklyReportSettings {
  constructor(private db: DatabaseService) {}

  async recipients(): Promise<{ destinatarios: string[]; disponible: boolean }> {
    try {
      const row = (await this.db.query<{ value: unknown }>('SELECT value FROM arm_app.app_settings WHERE key=$1', [KEY])).rows[0];
      const list = Array.isArray(row?.value) ? row!.value.filter((v): v is string => typeof v === 'string') : [];
      return { destinatarios: list, disponible: true };
    } catch (err) {
      if (missingTable(err)) return { destinatarios: [], disponible: false };
      throw err;
    }
  }

  async saveRecipients(list: string[], by: string) {
    const clean = [...new Set(list.map((d) => d.trim().toLowerCase()).filter(Boolean))].slice(0, 40);
    try {
      await this.db.query(
        `INSERT INTO arm_app.app_settings(key,value,"updatedAt","updatedBy") VALUES ($1,$2,now(),$3)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value,"updatedAt"=now(),"updatedBy"=excluded."updatedBy"`,
        [KEY, JSON.stringify(clean), by],
      );
      return { destinatarios: clean, disponible: true };
    } catch (err) {
      if (missingTable(err)) throw new ServiceUnavailableException('Guardar la lista aún no está habilitado. Pide al administrador del sistema que aplique la migración de configuración.');
      throw err;
    }
  }
}
