import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DATABASE } from '../database/database.module';
import { Sql } from 'postgres';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.db`select 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      // The API is alive even if the database blips; report degraded.
      return { status: 'degraded', database: 'down' };
    }
  }
}
