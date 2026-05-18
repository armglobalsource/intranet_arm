import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FirebaseService } from '../common/firebase/firebase.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private fb: FirebaseService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check — verifica app, Firestore' })
  async check() {
    let dbStatus = 'ok';
    try {
      // Lightweight Firestore check — read the _counters document
      await this.fb.db.collection('_counters').doc('users').get();
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { firestore: dbStatus },
    };
  }
}
