import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import Bull from 'bull';
import { Scan } from './scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { ScanStatus, ScanType, SeverityLevel } from '../../common/enums/index.js';
import { CreateScanDto } from './dto/create-scan.dto.js';
import { BulkCreateScanDto } from './dto/bulk-create-scan.dto.js';

export interface BulkScanResult {
  scans: Scan[];
  errors: Array<{ assetId: string; reason: string }>;
}
import { ScriptRunnerService } from '../scan-engine/script-runner.service.js';
import type { ScanJobData } from '../scan-engine/scan-orchestrator.service.js';
import type {
  ScanResponseDto,
  ScanListResponseDto,
  ScanFindingResponseDto,
  SeverityCountsDto,
} from './dto/scan-response.dto.js';

const MAX_CONCURRENT_SCANS_PER_ORG = 3;

interface ScanListQuery {
  status?: ScanStatus;
  type?: ScanType;
  assetId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectQueue('scan-queue')
    private readonly scanQueue: Bull.Queue,
    private readonly scriptRunner: ScriptRunnerService,
  ) {}

  async createScan(
    orgId: string,
    userId: string,
    dto: CreateScanDto,
  ): Promise<Scan> {
    // 1. Validate asset belongs to org
    const asset = await this.assetRepo.findOne({
      where: { id: dto.assetId, orgId },
    });

    if (!asset) {
      throw new NotFoundException(
        'Asset not found or does not belong to this organization',
      );
    }

    // 2. Check concurrent scan limit
    const runningScans = await this.scanRepo.count({
      where: [
        { orgId, status: ScanStatus.PENDING },
        { orgId, status: ScanStatus.RUNNING },
      ],
    });

    if (runningScans >= MAX_CONCURRENT_SCANS_PER_ORG) {
      throw new ConflictException(
        `Maximum ${MAX_CONCURRENT_SCANS_PER_ORG} concurrent scans per organization. Please wait for a scan to complete.`,
      );
    }

    // 3. Create scan with status PENDING
    const scan = this.scanRepo.create({
      type: dto.type,
      status: ScanStatus.PENDING,
      assetId: dto.assetId,
      orgId,
      initiatedBy: userId,
    });

    const savedScan = await this.scanRepo.save(scan);

    // 4. Add job to BullMQ queue
    const jobData: ScanJobData = {
      scanId: savedScan.id,
      assetId: asset.id,
      assetValue: asset.value,
      assetType: asset.type,
      scanType: dto.type,
      orgId,
      initiatedBy: userId,
      cookies: dto.cookies,
      customHeaders: dto.customHeaders,
    };

    try {
      await this.scanQueue.add(jobData, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      this.logger.log(
        `Scan ${savedScan.id} enqueued (type: ${dto.type}, asset: ${asset.value})`,
      );
    } catch (error) {
      // If queue fails, mark scan as failed
      await this.scanRepo.update(savedScan.id, {
        status: ScanStatus.FAILED,
        completedAt: new Date(),
      });

      this.logger.error(
        `Failed to enqueue scan ${savedScan.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new BadRequestException(
        'Failed to start scan. Please try again.',
      );
    }

    return savedScan;
  }

  async bulkCreateScans(
    orgId: string,
    userId: string,
    dto: BulkCreateScanDto,
  ): Promise<BulkScanResult> {
    const scans: Scan[] = [];
    const errors: Array<{ assetId: string; reason: string }> = [];

    // Validate all assets belong to org
    const assets = await this.assetRepo
      .createQueryBuilder('asset')
      .where('asset.id IN (:...ids)', { ids: dto.assetIds })
      .andWhere('asset.org_id = :orgId', { orgId })
      .getMany();

    const assetMap = new Map(assets.map((a) => [a.id, a]));

    for (const assetId of dto.assetIds) {
      const asset = assetMap.get(assetId);

      if (!asset) {
        errors.push({ assetId, reason: 'Asset not found in this organization' });
        continue;
      }

      try {
        // Create scan with PENDING status
        const scan = this.scanRepo.create({
          type: dto.type,
          status: ScanStatus.PENDING,
          assetId: asset.id,
          orgId,
          initiatedBy: userId,
        });

        const savedScan = await this.scanRepo.save(scan);

        // Enqueue to BullMQ
        const jobData: ScanJobData = {
          scanId: savedScan.id,
          assetId: asset.id,
          assetValue: asset.value,
          assetType: asset.type,
          scanType: dto.type,
          orgId,
          initiatedBy: userId,
        };

        await this.scanQueue.add(jobData, {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        scans.push(savedScan);

        this.logger.log(
          `Bulk scan: ${savedScan.id} enqueued (type: ${dto.type}, asset: ${asset.value})`,
        );
      } catch (error) {
        errors.push({
          assetId,
          reason: error instanceof Error ? error.message : 'Failed to enqueue',
        });
      }
    }

    return { scans, errors };
  }

  async cancelScan(scanId: string, orgId: string): Promise<Scan> {
    const scan = await this.scanRepo.findOne({
      where: { id: scanId, orgId },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    if (
      scan.status !== ScanStatus.PENDING &&
      scan.status !== ScanStatus.RUNNING
    ) {
      throw new BadRequestException(
        `Cannot cancel scan with status: ${scan.status}`,
      );
    }

    // Kill any running Python scripts for this scan
    if (scan.status === ScanStatus.RUNNING) {
      await this.scriptRunner.killScan(scanId);
    }

    // Remove all matching Bull jobs from the queue so the worker slot is freed.
    // Without this, cancelled jobs remain active in the queue and block new scans.
    try {
      const [waiting, active, delayed] = await Promise.all([
        this.scanQueue.getWaiting(),
        this.scanQueue.getActive(),
        this.scanQueue.getDelayed(),
      ]);

      const matchingJobs = [...waiting, ...active, ...delayed].filter(
        (job) => (job.data as ScanJobData).scanId === scanId,
      );

      await Promise.all(matchingJobs.map((job) => job.remove()));

      if (matchingJobs.length > 0) {
        this.logger.log(
          `Removed ${matchingJobs.length} Bull job(s) for cancelled scan ${scanId}`,
        );
      }
    } catch (error) {
      // Don't fail the cancellation if queue cleanup fails
      this.logger.warn(
        `Could not clean Bull queue for scan ${scanId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    // Update status in DB
    await this.scanRepo.update(scanId, {
      status: ScanStatus.CANCELLED,
      completedAt: new Date(),
    });

    this.logger.log(`Scan ${scanId} cancelled`);

    return this.scanRepo.findOneOrFail({ where: { id: scanId } });
  }

  async deleteScan(scanId: string, orgId: string): Promise<void> {
    const scan = await this.scanRepo.findOne({
      where: { id: scanId, orgId },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    // Don't allow deleting running scans — cancel first
    if (scan.status === ScanStatus.RUNNING || scan.status === ScanStatus.PENDING) {
      throw new BadRequestException(
        'Cannot delete a running or pending scan. Cancel it first.',
      );
    }

    // CASCADE will clean up findings, reports, ai-analysis
    await this.scanRepo.remove(scan);
    this.logger.log(`Scan ${scanId} deleted`);
  }

  async getScan(scanId: string, orgId: string): Promise<ScanResponseDto> {
    const scan = await this.scanRepo.findOne({
      where: { id: scanId, orgId },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return this.toScanResponse(scan);
  }

  async listScans(
    orgId: string,
    query: ScanListQuery,
  ): Promise<ScanListResponseDto> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const qb = this.scanRepo
      .createQueryBuilder('scan')
      .where('scan.orgId = :orgId', { orgId });

    if (query.status) {
      qb.andWhere('scan.status = :status', { status: query.status });
    }

    if (query.type) {
      qb.andWhere('scan.type = :type', { type: query.type });
    }

    if (query.assetId) {
      qb.andWhere('scan.assetId = :assetId', { assetId: query.assetId });
    }

    qb.orderBy('scan.createdAt', 'DESC').skip(skip).take(limit);

    const [scans, total] = await qb.getManyAndCount();

    const data = await Promise.all(
      scans.map((scan) => this.toScanResponse(scan)),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFindings(
    scanId: string,
    orgId: string,
  ): Promise<ScanFindingResponseDto[]> {
    // Verify scan belongs to org
    const scan = await this.scanRepo.findOne({
      where: { id: scanId, orgId },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const findings = await this.findingRepo.find({
      where: { scanId },
      relations: ['vulnerability'],
      order: { createdAt: 'ASC' },
    });

    return findings.map((finding) => ({
      id: finding.id,
      evidence: finding.evidence,
      location: finding.location,
      rawOutput: finding.rawOutput,
      createdAt: finding.createdAt,
      vulnerability: {
        id: finding.vulnerability.id,
        name: finding.vulnerability.name,
        severity: finding.vulnerability.severity,
        description: finding.vulnerability.description,
        remediation: finding.vulnerability.remediation,
        category: finding.vulnerability.category,
        cveId: finding.vulnerability.cveId,
      },
    }));
  }

  async getRawOutput(
    scanId: string,
    orgId: string,
  ): Promise<string> {
    const scan = await this.scanRepo.findOne({
      where: { id: scanId, orgId },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const findings = await this.findingRepo.find({
      where: { scanId },
      relations: ['vulnerability'],
      order: { createdAt: 'ASC' },
    });

    if (findings.length === 0) {
      return scan.status === 'COMPLETED'
        ? 'Scan completed with no findings. The target may be unreachable or all checks passed.'
        : 'No raw output available.';
    }

    const lines: string[] = [];
    lines.push(`Scan ID: ${scanId}`);
    lines.push(`Status: ${scan.status}`);
    lines.push(`Type: ${scan.type}`);
    lines.push(`Started: ${scan.startedAt?.toISOString() ?? 'N/A'}`);
    lines.push(`Completed: ${scan.completedAt?.toISOString() ?? 'N/A'}`);
    lines.push(`Total Findings: ${findings.length}`);
    lines.push('');
    lines.push('─'.repeat(60));

    for (const finding of findings) {
      lines.push('');
      lines.push(`[${finding.vulnerability?.severity ?? 'UNKNOWN'}] ${finding.vulnerability?.name ?? 'Unknown'}`);
      lines.push(`  Location: ${finding.location}`);
      lines.push(`  Category: ${finding.vulnerability?.category ?? 'N/A'}`);
      if (finding.evidence) {
        lines.push(`  Evidence: ${finding.evidence}`);
      }
      if (finding.rawOutput) {
        try {
          const parsed = JSON.parse(finding.rawOutput);
          lines.push(`  Details: ${JSON.stringify(parsed, null, 2).split('\n').join('\n  ')}`);
        } catch {
          lines.push(`  Raw: ${finding.rawOutput}`);
        }
      }
    }

    return lines.join('\n');
  }

  async updateStatus(
    scanId: string,
    status: ScanStatus,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === ScanStatus.RUNNING) {
      updateData['startedAt'] = new Date();
    }
    if (
      status === ScanStatus.COMPLETED ||
      status === ScanStatus.FAILED ||
      status === ScanStatus.CANCELLED
    ) {
      updateData['completedAt'] = new Date();
    }

    await this.scanRepo.update(scanId, updateData);
  }

  private async toScanResponse(scan: Scan): Promise<ScanResponseDto> {
    // Get findings count and severity breakdown
    const severityCounts = await this.getSeverityCounts(scan.id);
    const findingsCount =
      severityCounts.critical +
      severityCounts.high +
      severityCounts.medium +
      severityCounts.low;

    // Load asset relation
    const asset = await this.assetRepo.findOne({ where: { id: scan.assetId } });

    return {
      id: scan.id,
      type: scan.type,
      status: scan.status,
      isScheduled: scan.isScheduled,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      createdAt: scan.createdAt,
      assetId: scan.assetId,
      orgId: scan.orgId,
      initiatedBy: scan.initiatedBy,
      findingsCount,
      severityCounts,
      asset: asset ? { id: asset.id, name: asset.name, value: asset.value, type: asset.type } : undefined,
      findingsSummary: {
        critical: severityCounts.critical,
        high: severityCounts.high,
        medium: severityCounts.medium,
        low: severityCounts.low,
        total: findingsCount,
      },
    };
  }

  private async getSeverityCounts(
    scanId: string,
  ): Promise<SeverityCountsDto> {
    const counts = await this.findingRepo
      .createQueryBuilder('sf')
      .innerJoin('sf.vulnerability', 'v')
      .select('v.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('sf.scanId = :scanId', { scanId })
      .groupBy('v.severity')
      .getRawMany<{ severity: SeverityLevel; count: string }>();

    const result: SeverityCountsDto = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const row of counts) {
      const count = parseInt(row.count, 10);
      switch (row.severity) {
        case SeverityLevel.CRITICAL:
          result.critical = count;
          break;
        case SeverityLevel.HIGH:
          result.high = count;
          break;
        case SeverityLevel.MEDIUM:
          result.medium = count;
          break;
        case SeverityLevel.LOW:
          result.low = count;
          break;
      }
    }

    return result;
  }
}
