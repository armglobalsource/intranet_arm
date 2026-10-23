import { Module } from '@nestjs/common';
import { PostgresIdentityModule } from './postgres-identity.module';

// All application routes use PostgreSQL (Supabase).
@Module({imports:[PostgresIdentityModule]})
export class AppModule {}
