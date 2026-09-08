import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [BusinessesModule],
  controllers: [RestaurantsController],
})
export class RestaurantsModule {}
