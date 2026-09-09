import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [DiscoveryModule, UploadsModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
