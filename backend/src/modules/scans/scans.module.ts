import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Scan } from './scan.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Vulnerability } from '../findings/vulnerability.entity.js';
import { ScansController } from './scans.controller.js';
import { ScanProgressController } from './scan-progress.controller.js';
import { ScansService } from './scans.service.js';
import { ScanEngineModule } from '../scan-engine/scan-engine.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan, Asset, ScanFinding, Vulnerability]),
    BullModule.registerQueue({ name: 'scan-queue' }),
    ScanEngineModule,
    AuthModule,
  ],
  controllers: [ScansController, ScanProgressController],
  providers: [ScansService],
  exports: [TypeOrmModule, ScansService],
})
export class ScansModule {}
