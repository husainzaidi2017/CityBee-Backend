import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [DiscoveryModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
