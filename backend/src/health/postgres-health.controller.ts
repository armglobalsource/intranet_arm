import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { Public } from '../common/decorators/public.decorator';
@Controller('health')
export class PostgresHealthController {
  constructor(private db:DatabaseService) {}
  @Public()
  @Get()
  async check() {
    try {await this.db.ping();}
    catch {throw new ServiceUnavailableException({status:'degraded',services:{postgres:'error'}});}
    return {status:'ok',timestamp:new Date().toISOString(),services:{postgres:'ok'}};
  }
}
