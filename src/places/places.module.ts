import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [DiscoveryModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
