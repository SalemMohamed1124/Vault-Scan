import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/asset.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Vulnerability } from '../findings/vulnerability.entity.js';
import { AIAnalysis } from '../ai-analysis/ai-analysis.entity.js';
import { ScanStatus } from '../../common/enums/index.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
    @InjectRepository(Vulnerability)
    private readonly vulnRepo: Repository<Vulnerability>,
    @InjectRepository(AIAnalysis)
    private readonly aiAnalysisRepo: Repository<AIAnalysis>,
  ) {}

  async getStats(orgId: string) {
    const totalAssets = await this.assetRepo.count({ where: { orgId } });

    const activeScans = await this.scanRepo.count({
      where: { orgId, status: ScanStatus.RUNNING },
    });

    // Count open findings (all findings from scans in this org)
    const openFindings = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .where('s.org_id = :orgId', { orgId })
      .getCount();

    // Count critical findings
    const criticalIssues = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoin('f.vulnerability', 'v')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('v.severity = :severity', { severity: 'CRITICAL' })
      .getCount();

    return { totalAssets, activeScans, openFindings, criticalIssues };
  }

  async getVulnerabilitiesBySeverity(orgId: string) {
    const results = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoin('f.vulnerability', 'v')
      .select('v.severity', 'severity')
      .addSelect('COUNT(f.id)', 'count')
      .where('s.org_id = :orgId', { orgId })
      .groupBy('v.severity')
      .getRawMany<{ severity: string; count: string }>();

    // Ensure all severities are present
    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    return severities.map((severity) => ({
      severity,
      count: parseInt(results.find((r) => r.severity === severity)?.count ?? '0', 10),
    }));
  }

  /**
   * Generate an array of date strings for the last N days (inclusive of today).
   */
  private generateDateRange(days: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  async getVulnerabilityTrends(orgId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const results = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoin('f.vulnerability', 'v')
      .select('DATE(f.created_at)', 'date')
      .addSelect('v.severity', 'severity')
      .addSelect('COUNT(f.id)', 'count')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('f.created_at >= :since', { since: thirtyDaysAgo })
      .groupBy('DATE(f.created_at)')
      .addGroupBy('v.severity')
      .getRawMany<{ date: string; severity: string; count: string }>();

    const dateRange = this.generateDateRange(30);

    // Build a map: date -> { critical, high, medium, low }
    const map = new Map<string, { critical: number; high: number; medium: number; low: number }>();
    for (const date of dateRange) {
      map.set(date, { critical: 0, high: 0, medium: 0, low: 0 });
    }

    for (const row of results) {
      const dateStr = typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10);
      const entry = map.get(dateStr);
      if (entry) {
        const sev = row.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low';
        if (sev in entry) {
          entry[sev] = parseInt(row.count, 10);
        }
      }
    }

    return dateRange.map((date) => ({ date, ...map.get(date)! }));
  }

  async getScanActivity(orgId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const results = await this.scanRepo
      .createQueryBuilder('s')
      .select('DATE(s.created_at)', 'date')
      .addSelect('s.status', 'status')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('s.created_at >= :since', { since: thirtyDaysAgo })
      .groupBy('DATE(s.created_at)')
      .addGroupBy('s.status')
      .getRawMany<{ date: string; status: string; count: string }>();

    const dateRange = this.generateDateRange(30);
    const map = new Map<string, { completed: number; failed: number; total: number }>();
    for (const date of dateRange) {
      map.set(date, { completed: 0, failed: 0, total: 0 });
    }

    for (const row of results) {
      const dateStr = typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10);
      const entry = map.get(dateStr);
      if (entry) {
        const cnt = parseInt(row.count, 10);
        entry.total += cnt;
        if (row.status === ScanStatus.COMPLETED) {
          entry.completed += cnt;
        } else if (row.status === ScanStatus.FAILED) {
          entry.failed += cnt;
        }
      }
    }

    return dateRange.map((date) => ({ date, ...map.get(date)! }));
  }

  async getRecentActivity(orgId: string) {
    // Recent completed/failed scans
    const recentScans = await this.scanRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.asset', 'a')
      .leftJoin('s.findings', 'f')
      .addSelect('COUNT(f.id)', 'findingCount')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('s.status IN (:...statuses)', { statuses: [ScanStatus.COMPLETED, ScanStatus.FAILED] })
      .groupBy('s.id')
      .addGroupBy('a.id')
      .orderBy('s.completed_at', 'DESC', 'NULLS LAST')
      .limit(15)
      .getRawAndEntities();

    const scanEvents = recentScans.raw.map((raw, idx) => {
      const scan = recentScans.entities[idx];
      const findingCount = parseInt(raw.findingCount ?? '0', 10);
      const isCompleted = scan.status === ScanStatus.COMPLETED;
      const typeLabel = scan.type === 'QUICK' ? 'Quick' : 'Deep';
      return {
        id: scan.id,
        type: isCompleted ? 'SCAN_COMPLETED' : 'SCAN_FAILED',
        title: `${typeLabel} scan ${isCompleted ? 'completed' : 'failed'}`,
        subtitle: `${scan.asset.name}${isCompleted ? ` - ${findingCount} findings` : ''}`,
        timestamp: scan.completedAt ?? scan.createdAt,
        severity: isCompleted ? (findingCount > 10 ? 'high' : findingCount > 0 ? 'medium' : 'low') : 'high',
      };
    });

    // Recent critical/high findings
    const recentFindings = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoinAndSelect('f.vulnerability', 'v')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('v.severity IN (:...severities)', { severities: ['CRITICAL', 'HIGH'] })
      .orderBy('f.created_at', 'DESC')
      .limit(15)
      .getMany();

    const findingEvents = recentFindings.map((f) => ({
      id: f.id,
      type: 'FINDING_DISCOVERED',
      title: `${f.vulnerability.name} found`,
      subtitle: f.location,
      timestamp: f.createdAt,
      severity: f.vulnerability.severity.toLowerCase(),
    }));

    // Merge & sort by timestamp DESC, take 15
    const allEvents = [...scanEvents, ...findingEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);

    return allEvents;
  }

  async getTopVulnerabilities(orgId: string) {
    const results = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoin('f.vulnerability', 'v')
      .select('v.name', 'name')
      .addSelect('v.severity', 'severity')
      .addSelect('v.category', 'category')
      .addSelect('COUNT(f.id)', 'count')
      .where('s.org_id = :orgId', { orgId })
      .groupBy('v.name')
      .addGroupBy('v.severity')
      .addGroupBy('v.category')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<{ name: string; severity: string; count: string; category: string }>();

    return results.map((r) => ({
      name: r.name,
      severity: r.severity,
      count: parseInt(r.count, 10),
      category: r.category,
    }));
  }

  async getSecurityScore(orgId: string) {
    // --- Vulnerability score ---
    const severityCounts = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoin('f.vulnerability', 'v')
      .select('v.severity', 'severity')
      .addSelect('COUNT(f.id)', 'count')
      .where('s.org_id = :orgId', { orgId })
      .groupBy('v.severity')
      .getRawMany<{ severity: string; count: string }>();

    const countBySev: Record<string, number> = {};
    for (const row of severityCounts) {
      countBySev[row.severity] = parseInt(row.count, 10);
    }

    const vulnScore = Math.max(
      0,
      100 -
        (countBySev['CRITICAL'] ?? 0) * 15 -
        (countBySev['HIGH'] ?? 0) * 8 -
        (countBySev['MEDIUM'] ?? 0) * 3 -
        (countBySev['LOW'] ?? 0) * 1,
    );

    // --- Scan coverage ---
    const totalAssets = await this.assetRepo.count({ where: { orgId } });
    const assetsWithCompletedScan = await this.assetRepo
      .createQueryBuilder('a')
      .innerJoin('a.scans', 's')
      .where('a.org_id = :orgId', { orgId })
      .andWhere('s.status = :status', { status: ScanStatus.COMPLETED })
      .select('COUNT(DISTINCT a.id)', 'count')
      .getRawOne<{ count: string }>();

    const scannedCount = parseInt(assetsWithCompletedScan?.count ?? '0', 10);
    const scanCoverage = totalAssets > 0 ? Math.round((scannedCount / totalAssets) * 100) : 0;

    // --- Response time ---
    const avgResponseResult = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('s.completed_at IS NOT NULL')
      .select('AVG(EXTRACT(EPOCH FROM (s.completed_at - f.created_at)))', 'avgSeconds')
      .getRawOne<{ avgSeconds: string | null }>();

    const avgSeconds = parseFloat(avgResponseResult?.avgSeconds ?? '0');
    let responseTime: number;
    if (avgSeconds === 0) {
      responseTime = 100; // No findings or instant
    } else if (avgSeconds < 3600) {
      responseTime = 100;
    } else if (avgSeconds < 86400) {
      responseTime = 70;
    } else {
      responseTime = 40;
    }

    // --- Overall score ---
    const score = Math.round(vulnScore * 0.5 + scanCoverage * 0.3 + responseTime * 0.2);

    const getGrade = (s: number): string => {
      if (s >= 90) return 'A';
      if (s >= 75) return 'B';
      if (s >= 60) return 'C';
      if (s >= 40) return 'D';
      return 'F';
    };

    // --- Previous score (before the most recent scan) ---
    const mostRecentScan = await this.scanRepo.findOne({
      where: { orgId, status: ScanStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });

    let previousScore = score; // default if no prior scan

    if (mostRecentScan?.completedAt) {
      const prevCutoff = mostRecentScan.completedAt;

      // Previous vulnerability score
      const prevSevCounts = await this.findingRepo
        .createQueryBuilder('f')
        .innerJoin('f.scan', 's')
        .innerJoin('f.vulnerability', 'v')
        .select('v.severity', 'severity')
        .addSelect('COUNT(f.id)', 'count')
        .where('s.org_id = :orgId', { orgId })
        .andWhere('s.completed_at < :cutoff', { cutoff: prevCutoff })
        .groupBy('v.severity')
        .getRawMany<{ severity: string; count: string }>();

      const prevCountBySev: Record<string, number> = {};
      for (const row of prevSevCounts) {
        prevCountBySev[row.severity] = parseInt(row.count, 10);
      }
      const prevVulnScore = Math.max(
        0,
        100 -
          (prevCountBySev['CRITICAL'] ?? 0) * 15 -
          (prevCountBySev['HIGH'] ?? 0) * 8 -
          (prevCountBySev['MEDIUM'] ?? 0) * 3 -
          (prevCountBySev['LOW'] ?? 0) * 1,
      );

      // Previous scan coverage
      const prevScannedResult = await this.assetRepo
        .createQueryBuilder('a')
        .innerJoin('a.scans', 's')
        .where('a.org_id = :orgId', { orgId })
        .andWhere('s.status = :status', { status: ScanStatus.COMPLETED })
        .andWhere('s.completed_at < :cutoff', { cutoff: prevCutoff })
        .select('COUNT(DISTINCT a.id)', 'count')
        .getRawOne<{ count: string }>();

      const prevScannedCount = parseInt(prevScannedResult?.count ?? '0', 10);
      const prevScanCoverage = totalAssets > 0 ? Math.round((prevScannedCount / totalAssets) * 100) : 0;

      // Previous response time
      const prevAvgResult = await this.findingRepo
        .createQueryBuilder('f')
        .innerJoin('f.scan', 's')
        .where('s.org_id = :orgId', { orgId })
        .andWhere('s.completed_at IS NOT NULL')
        .andWhere('s.completed_at < :cutoff', { cutoff: prevCutoff })
        .select('AVG(EXTRACT(EPOCH FROM (s.completed_at - f.created_at)))', 'avgSeconds')
        .getRawOne<{ avgSeconds: string | null }>();

      const prevAvgSeconds = parseFloat(prevAvgResult?.avgSeconds ?? '0');
      let prevResponseTime: number;
      if (prevAvgSeconds === 0) {
        prevResponseTime = 100;
      } else if (prevAvgSeconds < 3600) {
        prevResponseTime = 100;
      } else if (prevAvgSeconds < 86400) {
        prevResponseTime = 70;
      } else {
        prevResponseTime = 40;
      }

      previousScore = Math.round(prevVulnScore * 0.5 + prevScanCoverage * 0.3 + prevResponseTime * 0.2);
    }

    const trend: 'up' | 'down' | 'stable' =
      score > previousScore ? 'up' : score < previousScore ? 'down' : 'stable';

    return {
      score,
      grade: getGrade(score),
      previousScore,
      trend,
      breakdown: {
        vulnerabilities: vulnScore,
        scanCoverage,
        responseTime,
      },
    };
  }
}
