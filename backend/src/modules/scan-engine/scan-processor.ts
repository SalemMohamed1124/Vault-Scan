import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import Bull from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scan } from '../scans/scan.entity.js';
import { ScanStatus, ScanType } from '../../common/enums/index.js';
import { ScanOrchestratorService } from './scan-orchestrator.service.js';
import type { ScanJobData } from './scan-orchestrator.service.js';

@Processor('scan-queue')
export class ScanProcessor {
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(
    private readonly orchestrator: ScanOrchestratorService,
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
  ) {}

  @Process()
  async handleScan(job: Bull.Job): Promise<void> {
    const jobData = job.data as ScanJobData;
    const { scanId, scanType } = jobData;

    this.logger.log(
      `Processing scan job ${String(job.id)} — scanId: ${scanId}, type: ${scanType}`,
    );

    try {
      const scan = await this.scanRepo.findOne({ where: { id: scanId } });
      
      if (!scan) {
        this.logger.warn(`Scan ${scanId} was deleted. Skipping job.`);
        return;
      }

      if (scan.status !== ScanStatus.PENDING) {
        this.logger.warn(`Scan ${scanId} is not in PENDING state (status: ${scan.status}). Skipping job.`);
        return;
      }

      if (scanType === ScanType.QUICK) {
        await this.orchestrator.runQuickScan(jobData);
      } else if (scanType === ScanType.DEEP) {
        await this.orchestrator.runDeepScan(jobData);
      } else {
        throw new Error(`Unknown scan type: ${scanType}`);
      }
    } catch (error) {
      this.logger.error(
        `Scan ${scanId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Update scan to FAILED if not already set
      const scan = await this.scanRepo.findOne({ where: { id: scanId } });
      if (scan && scan.status !== ScanStatus.FAILED) {
        await this.scanRepo.update(scanId, {
          status: ScanStatus.FAILED,
          completedAt: new Date(),
        });
      }

      throw error; // Let BullMQ handle retry
    }
  }
}
