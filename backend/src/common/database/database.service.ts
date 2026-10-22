import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { buildPostgresOptions } from './postgres-options';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool?: Pool;

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean { return !!this.config.get<string>('DATABASE_URL'); }

  private getPool(): Pool {
    if (!this.pool) {
      const connection = this.config.get<string>('DATABASE_URL');
      if (!connection) throw new Error('DATABASE_URL no está configurada en el backend');
      this.pool = new Pool(buildPostgresOptions(connection, this.config.get<string>('DATABASE_CA_CERT')));
      this.pool.on('error', () => this.logger.error('Error en una conexión PostgreSQL inactiva'));
    }
    return this.pool;
  }

  query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<Row>> {
    // No named prepared statements: compatible with transaction pooling.
    return this.getPool().query<Row>(text, values);
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); }
      catch { discard = true; }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  async ping(): Promise<void> { await this.query('select 1'); }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.end();
  }
}
