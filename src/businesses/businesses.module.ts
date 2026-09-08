import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [DiscoveryModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
