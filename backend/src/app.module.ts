import { Module } from '@nestjs/common';
import { PostgresIdentityModule } from './postgres-identity.module';

// All normal application routes use PostgreSQL. No runtime Firestore fallback.
@Module({imports:[PostgresIdentityModule]})
export class AppModule {}
