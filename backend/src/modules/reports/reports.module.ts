import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Report } from './report.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { AIAnalysis } from '../ai-analysis/ai-analysis.entity.js';
import { Organization } from '../organizations/organization.entity.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { PdfGeneratorService } from './pdf-generator.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Scan, ScanFinding, AIAnalysis, Organization]),
    ConfigModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, PdfGeneratorService],
  exports: [TypeOrmModule, ReportsService],
})
export class ReportsModule {}
