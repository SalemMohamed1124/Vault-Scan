import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ScanFinding } from './scan-finding.entity.js';

interface FindAllQuery {
  page?: number;
  limit?: number;
  severity?: string;
  search?: string;
  category?: string;
  assetId?: string;
  scanId?: string;
}

@Injectable()
export class FindingsService {
  constructor(
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
  ) {}

  async findAll(orgId: string, query: FindAllQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.findingRepo
      .createQueryBuilder('f')
      .innerJoinAndSelect('f.vulnerability', 'v')
      .innerJoinAndSelect('f.scan', 's')
      .leftJoinAndSelect('s.asset', 'a')
      .where('s.orgId = :orgId', { orgId });

    if (query.severity) {
      const severities = query.severity.split(',');
      qb.andWhere('v.severity IN (:...severities)', { severities });
    }

    if (query.category) {
      qb.andWhere('v.category = :category', { category: query.category });
    }

    if (query.assetId) {
      qb.andWhere('s.assetId = :assetId', { assetId: query.assetId });
    }

    if (query.scanId) {
      qb.andWhere('s.id = :scanId', { scanId: query.scanId });
    }

    if (query.search) {
      qb.andWhere(
        '(v.name ILIKE :search OR f.location ILIKE :search OR v.category ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('f.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // Severity counts (across ALL filtered findings, not just page)
    const countsQb = this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.vulnerability', 'v')
      .innerJoin('f.scan', 's')
      .select('v.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('s.orgId = :orgId', { orgId })
      .groupBy('v.severity');

    if (query.search) {
      countsQb.andWhere(
        '(v.name ILIKE :search OR f.location ILIKE :search OR v.category ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const severityRows = await countsQb.getRawMany<{ severity: string; count: string }>();
    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const row of severityRows) {
      const key = row.severity as keyof typeof severityCounts;
      if (key in severityCounts) {
        severityCounts[key] = parseInt(row.count, 10);
      }
    }

    // Category counts for filter dropdown
    const categoryRows = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.vulnerability', 'v')
      .innerJoin('f.scan', 's')
      .select('v.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('s.orgId = :orgId', { orgId })
      .groupBy('v.category')
      .orderBy('count', 'DESC')
      .getRawMany<{ category: string; count: string }>();

    const categoryCounts = categoryRows.map((r) => ({
      category: r.category,
      count: parseInt(r.count, 10),
    }));

    // Transform data
    const transformed = data.map((f) => ({
      id: f.id,
      scanId: f.scanId,
      location: f.location,
      evidence: f.evidence,
      createdAt: f.createdAt,
      vulnerability: f.vulnerability,
      scan: f.scan
        ? {
            id: f.scan.id,
            type: f.scan.type,
            asset: f.scan.asset
              ? { id: f.scan.asset.id, name: f.scan.asset.name, value: f.scan.asset.value }
              : undefined,
          }
        : undefined,
    }));

    return { data: transformed, total, page, limit, severityCounts, categoryCounts };
  }

  async deleteOne(id: string, orgId: string): Promise<void> {
    const finding = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .where('f.id = :id', { id })
      .andWhere('s.orgId = :orgId', { orgId })
      .getOne();

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    await this.findingRepo.remove(finding);
  }

  async deleteMany(ids: string[], orgId: string): Promise<void> {
    if (!ids || ids.length === 0) return;

    // Verify all findings belong to this org
    const findings = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .where('f.id IN (:...ids)', { ids })
      .andWhere('s.orgId = :orgId', { orgId })
      .getMany();

    if (findings.length > 0) {
      await this.findingRepo.remove(findings);
    }
  }
}
