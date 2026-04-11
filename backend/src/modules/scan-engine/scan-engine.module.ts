import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Vulnerability } from '../findings/vulnerability.entity.js';
import { ScriptRunnerService } from './script-runner.service.js';
import { AggregatorService } from './aggregator.service.js';
import { ScanOrchestratorService } from './scan-orchestrator.service.js';
import { ScanProcessor } from './scan-processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'scan-queue' }),
    TypeOrmModule.forFeature([Scan, ScanFinding, Vulnerability]),
  ],
  providers: [
    ScriptRunnerService,
    AggregatorService,
    ScanOrchestratorService,
    ScanProcessor,
  ],
  exports: [ScriptRunnerService, AggregatorService, ScanOrchestratorService],
})
export class ScanEngineModule {}
