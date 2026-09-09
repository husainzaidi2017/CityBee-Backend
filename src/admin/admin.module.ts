import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminRoleGuard } from './admin-role.guard';

/** Admin CRUD surface for the web admin panel (role = 'admin' only). */
@Module({
  controllers: [AdminController],
  providers: [AdminRoleGuard],
})
export class AdminModule {}
