import { Module } from '@nestjs/common';
import { HotelsController } from './hotels.controller';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [BusinessesModule],
  controllers: [HotelsController],
})
export class HotelsModule {}
