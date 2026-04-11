import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './asset.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Vulnerability } from '../findings/vulnerability.entity.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Scan, ScanFinding, Vulnerability])],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [TypeOrmModule, AssetsService],
})
export class AssetsModule {}
