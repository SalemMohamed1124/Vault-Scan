import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Report } from './report.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { AIAnalysis } from '../ai-analysis/ai-analysis.entity.js';
import { Organization } from '../organizations/organization.entity.js';
import { ReportFormat, ScanStatus, SeverityLevel } from '../../common/enums/index.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { PdfGeneratorService } from './pdf-generator.service.js';

interface ReportFindingItem {
  vulnerability: string;
  severity: string;
  location: string;
  evidence: string;
  remediation: string;
  category: string;
}

interface ReportKeyFinding {
  title: string;
  impact: string;
  likelihood: string;
}

interface ReportRecommendation {
  priority: number;
  action: string;
  rationale: string;
  effort: string;
}

interface ReportData {
  generatedAt: string;
  organization: { name: string };
  asset: { name: string; type: string; value: string };
  scan: {
    id: string;
    type: string;
    status: string;
    startedAt: string;
    completedAt: string;
    duration: string;
  };
  aiAnalysis: {
    riskScore: number | null;
    riskLevel: string | null;
    executiveSummary: string | null;
    recommendations: ReportRecommendation[];
    keyFindings: ReportKeyFinding[];
    technicalDetails: string | null;
    complianceNotes: string | null;
  } | null;
  findings: {
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    items: ReportFindingItem[];
  };
}

const REPORTS_DIR = path.join(process.cwd(), 'tmp', 'reports');

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
    @InjectRepository(AIAnalysis)
    private readonly analysisRepo: Repository<AIAnalysis>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly configService: ConfigService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {
    // Ensure reports directory exists
    this.ensureReportsDir();
  }

  async generateReport(
    orgId: string,
    userId: string,
    dto: CreateReportDto,
  ): Promise<Report> {
    // 1. Verify scan belongs to org
    const scan = await this.scanRepo.findOne({
      where: { id: dto.scanId, orgId },
      relations: ['asset'],
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    // 2. Verify scan is COMPLETED
    if (scan.status !== ScanStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot generate report for scan with status: ${scan.status}. Scan must be COMPLETED.`,
      );
    }

    // 3. Build ReportData
    const reportData = await this.buildReportData(scan, orgId);

    // 4. Generate based on format
    let fileContent: Buffer;
    let filename: string;
    let contentType: string;

    switch (dto.format) {
      case ReportFormat.JSON: {
        const jsonStr = JSON.stringify(reportData, null, 2);
        fileContent = Buffer.from(jsonStr, 'utf-8');
        filename = `report-${dto.scanId}.json`;
        contentType = 'application/json';
        break;
      }
      case ReportFormat.HTML: {
        const htmlStr = this.pdfGenerator.renderHtmlReport(reportData);
        fileContent = Buffer.from(htmlStr, 'utf-8');
        filename = `report-${dto.scanId}.html`;
        contentType = 'text/html';
        break;
      }
      case ReportFormat.PDF: {
        fileContent = await this.pdfGenerator.generatePdf(reportData);
        filename = `report-${dto.scanId}.pdf`;
        contentType = 'application/pdf';
        break;
      }
      default:
        throw new BadRequestException(`Unsupported format: ${dto.format}`);
    }

    // 5. Save to reports directory
    const filePath = path.join(REPORTS_DIR, filename);
    fs.writeFileSync(filePath, fileContent);

    // 6. Generate download URL
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3001';

    // 7. Save report record
    const report = this.reportRepo.create({
      format: dto.format,
      filePath,
      scanId: dto.scanId,
      createdBy: userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    const savedReport = await this.reportRepo.save(report);

    // Set download URL after we have the ID
    savedReport.downloadUrl = `${backendUrl}/api/reports/download/${savedReport.id}`;
    await this.reportRepo.save(savedReport);

    this.logger.log(
      `Report ${savedReport.id} generated (${dto.format}) for scan ${dto.scanId}`,
    );

    return savedReport;
  }

  async listReports(orgId: string): Promise<Report[]> {
    return this.reportRepo
      .createQueryBuilder('report')
      .innerJoinAndSelect('report.scan', 'scan')
      .leftJoinAndSelect('scan.asset', 'asset')
      .where('scan.orgId = :orgId', { orgId })
      .orderBy('report.createdAt', 'DESC')
      .getMany();
  }

  async downloadReport(
    reportId: string,
    orgId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const report = await this.reportRepo
      .createQueryBuilder('report')
      .innerJoin('report.scan', 'scan')
      .where('report.id = :reportId', { reportId })
      .andWhere('scan.orgId = :orgId', { orgId })
      .getOne();

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Check expiry
    if (report.expiresAt && new Date() > new Date(report.expiresAt)) {
      throw new BadRequestException('Report has expired. Please generate a new one.');
    }

    // Check file exists
    if (!report.filePath || !fs.existsSync(report.filePath)) {
      throw new NotFoundException('Report file not found on disk.');
    }

    const buffer = fs.readFileSync(report.filePath);

    const contentTypeMap: Record<string, string> = {
      PDF: 'application/pdf',
      JSON: 'application/json',
      HTML: 'text/html',
    };

    const ext = report.format === ReportFormat.PDF ? 'pdf' : report.format === ReportFormat.JSON ? 'json' : 'html';
    const filename = `vaultscan-report-${reportId}.${ext}`;

    return {
      buffer,
      filename,
      contentType: contentTypeMap[report.format] || 'application/octet-stream',
    };
  }

  private async buildReportData(scan: Scan, orgId: string): Promise<ReportData> {
    // Load organization
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    const orgName = org?.name || 'Unknown Organization';

    // Load findings with vulnerabilities
    const findings = await this.findingRepo.find({
      where: { scanId: scan.id },
      relations: ['vulnerability'],
      order: { createdAt: 'ASC' },
    });

    // Load AI analysis (may not exist)
    const aiAnalysis = await this.analysisRepo.findOne({
      where: { scanId: scan.id },
    });

    // Build severity summary
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      switch (f.vulnerability.severity) {
        case SeverityLevel.CRITICAL:
          severityCounts.critical++;
          break;
        case SeverityLevel.HIGH:
          severityCounts.high++;
          break;
        case SeverityLevel.MEDIUM:
          severityCounts.medium++;
          break;
        case SeverityLevel.LOW:
          severityCounts.low++;
          break;
      }
    }

    // Build finding items
    const findingItems: ReportFindingItem[] = findings.map((f) => ({
      vulnerability: f.vulnerability.name,
      severity: f.vulnerability.severity,
      location: f.location,
      evidence: f.evidence || '',
      remediation: f.vulnerability.remediation || '',
      category: f.vulnerability.category || 'GENERAL',
    }));

    // Sort by severity order: CRITICAL, HIGH, MEDIUM, LOW
    const severityOrder: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    findingItems.sort(
      (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4),
    );

    // Build AI analysis data
    let aiData: ReportData['aiAnalysis'] = null;
    if (aiAnalysis && aiAnalysis.status === 'COMPLETED') {
      aiData = {
        riskScore: aiAnalysis.riskScore,
        riskLevel: aiAnalysis.riskLevel,
        executiveSummary: aiAnalysis.analysisText,
        recommendations: (aiAnalysis.recommendations || []) as unknown as ReportRecommendation[],
        keyFindings: (aiAnalysis.keyFindings || []) as unknown as ReportKeyFinding[],
        technicalDetails: aiAnalysis.technicalDetails,
        complianceNotes: aiAnalysis.complianceNotes,
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      organization: { name: orgName },
      asset: {
        name: scan.asset.name,
        type: scan.asset.type,
        value: scan.asset.value,
      },
      scan: {
        id: scan.id,
        type: scan.type,
        status: scan.status,
        startedAt: scan.startedAt?.toISOString() || 'N/A',
        completedAt: scan.completedAt?.toISOString() || 'N/A',
        duration: this.formatDuration(scan.startedAt, scan.completedAt),
      },
      aiAnalysis: aiData,
      findings: {
        summary: {
          ...severityCounts,
          total: findings.length,
        },
        items: findingItems,
      },
    };
  }

  private formatDuration(start: Date | null, end: Date | null): string {
    if (!start || !end) return 'N/A';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }

  private ensureReportsDir(): void {
    try {
      if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        this.logger.log(`Reports directory created: ${REPORTS_DIR}`);
      }
    } catch (error) {
      this.logger.warn(
        `Could not create reports directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
