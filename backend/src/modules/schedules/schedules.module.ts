import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScanSchedule } from './scan-schedule.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { SchedulesController } from './schedules.controller.js';
import { SchedulesService } from './schedules.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ScanSchedule, Asset])],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [TypeOrmModule, SchedulesService],
})
export class SchedulesModule {}
