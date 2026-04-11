import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../assets/asset.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Vulnerability } from '../findings/vulnerability.entity.js';
import { AIAnalysis } from '../ai-analysis/ai-analysis.entity.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Scan, ScanFinding, Vulnerability, AIAnalysis])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
