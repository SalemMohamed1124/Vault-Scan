import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Asset } from './asset.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Vulnerability } from '../findings/vulnerability.entity.js';
import { AssetType, ScanStatus, SeverityLevel } from '../../common/enums/index.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { BulkCreateAssetDto } from './dto/bulk-create-asset.dto.js';

export interface BulkCreateResult {
  created: Asset[];
  skipped: Array<{ value: string; reason: string }>;
}

interface AssetQuery {
  search?: string;
  type?: AssetType;
  page?: number;
  limit?: number;
}

export interface PaginatedAssets {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetStats {
  total: number;
  byType: Record<string, number>;
  lastScannedAt: Date | null;
  totalVulnerabilities: number;
  criticalCount: number;
}

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
    @InjectRepository(Vulnerability)
    private readonly vulnRepo: Repository<Vulnerability>,
  ) {}

  async findAll(orgId: string, query: AssetQuery): Promise<PaginatedAssets> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { orgId };

    if (query.type) {
      where['type'] = query.type;
    }

    const queryBuilder = this.assetRepo
      .createQueryBuilder('asset')
      .where('asset.org_id = :orgId', { orgId });

    if (query.type) {
      queryBuilder.andWhere('asset.type = :type', { type: query.type });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(asset.name ILIKE :search OR asset.value ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    queryBuilder.orderBy('asset.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string, orgId: string): Promise<Asset> {
    const asset = await this.assetRepo.findOne({
      where: { id, orgId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async create(orgId: string, userId: string, dto: CreateAssetDto): Promise<Asset> {
    const existing = await this.assetRepo.findOne({
      where: { value: dto.value, orgId },
    });

    if (existing) {
      throw new ConflictException('An asset with this value already exists in this organization');
    }

    const asset = this.assetRepo.create({
      name: dto.name,
      type: dto.type,
      value: dto.value,
      orgId,
      createdBy: userId,
    });

    return this.assetRepo.save(asset);
  }

  async bulkCreate(
    orgId: string,
    userId: string,
    dto: BulkCreateAssetDto,
  ): Promise<BulkCreateResult> {
    const created: Asset[] = [];
    const skipped: Array<{ value: string; reason: string }> = [];

    for (const item of dto.items) {
      try {
        const existing = await this.assetRepo.findOne({
          where: { value: item.value, orgId },
        });

        if (existing) {
          skipped.push({ value: item.value, reason: 'Duplicate — already exists' });
          continue;
        }

        const asset = this.assetRepo.create({
          name: item.name,
          type: item.type,
          value: item.value,
          orgId,
          createdBy: userId,
        });

        const saved = await this.assetRepo.save(asset);
        created.push(saved);
      } catch (error) {
        skipped.push({
          value: item.value,
          reason:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { created, skipped };
  }

  async update(id: string, orgId: string, dto: UpdateAssetDto): Promise<Asset> {
    const asset = await this.findOne(id, orgId);

    if (dto.value && dto.value !== asset.value) {
      const existing = await this.assetRepo.findOne({
        where: { value: dto.value, orgId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('An asset with this value already exists in this organization');
      }
    }

    if (dto.name !== undefined) asset.name = dto.name;
    if (dto.type !== undefined) asset.type = dto.type;
    if (dto.value !== undefined) asset.value = dto.value;

    return this.assetRepo.save(asset);
  }

  async remove(id: string, orgId: string): Promise<{ success: boolean }> {
    const asset = await this.findOne(id, orgId);

    const runningScan = await this.scanRepo.findOne({
      where: { assetId: asset.id, status: ScanStatus.RUNNING },
    });

    if (runningScan) {
      throw new BadRequestException('Cannot delete asset while a scan is running');
    }

    await this.assetRepo.remove(asset);
    return { success: true };
  }

  async getAssetStats(orgId: string): Promise<AssetStats> {
    const assets = await this.assetRepo.find({ where: { orgId } });
    const total = assets.length;

    const byType: Record<string, number> = {
      DOMAIN: 0,
      IP: 0,
      URL: 0,
      CIDR: 0,
    };

    for (const asset of assets) {
      byType[asset.type] = (byType[asset.type] ?? 0) + 1;
    }

    // Get last scanned time across all assets in this org
    const lastScan = await this.scanRepo
      .createQueryBuilder('scan')
      .where('scan.org_id = :orgId', { orgId })
      .andWhere('scan.completed_at IS NOT NULL')
      .orderBy('scan.completed_at', 'DESC')
      .getOne();

    // Count vulnerabilities from findings linked to scans in this org
    const vulnStats = await this.findingRepo
      .createQueryBuilder('finding')
      .innerJoin('finding.scan', 'scan')
      .innerJoin('finding.vulnerability', 'vuln')
      .where('scan.org_id = :orgId', { orgId })
      .select('COUNT(DISTINCT finding.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT CASE WHEN vuln.severity = '${SeverityLevel.CRITICAL}' THEN finding.id END)`,
        'critical',
      )
      .getRawOne<{ total: string; critical: string }>();

    return {
      total,
      byType,
      lastScannedAt: lastScan?.completedAt ?? null,
      totalVulnerabilities: parseInt(vulnStats?.total ?? '0', 10),
      criticalCount: parseInt(vulnStats?.critical ?? '0', 10),
    };
  }
}
