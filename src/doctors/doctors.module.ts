import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [BusinessesModule],
  controllers: [DoctorsController],
})
export class DoctorsModule {}
