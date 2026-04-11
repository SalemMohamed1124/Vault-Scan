import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { AIAnalysis } from './ai-analysis.entity.js';
import { GEMINI_CLIENT } from '../../config/gemini.config.js';
import { ScanStatus } from '../../common/enums/index.js';

export interface DashboardInsight {
  summary: string;
  priorities: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    actionable: string;
  }>;
  positiveFeedback: string;
  riskTrend: string;
}

export interface RemediationGuide {
  title: string;
  severity: string;
  whatIsIt: string;
  whyItMatters: string;
  steps: Array<{
    step: number;
    title: string;
    description: string;
    code?: string;
    language?: string;
  }>;
  verification: string;
  references: string[];
}

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  // Simple in-memory cache for dashboard insights (TTL: 5 min)
  private insightsCache = new Map<string, { data: DashboardInsight; expiresAt: number }>();

  constructor(
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AIAnalysis)
    private readonly analysisRepo: Repository<AIAnalysis>,
    @Inject(GEMINI_CLIENT)
    private readonly genAI: GoogleGenerativeAI,
    private readonly configService: ConfigService,
  ) {}

  async getDashboardInsights(orgId: string): Promise<DashboardInsight> {
    // Check cache
    const cached = this.insightsCache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp';

    try {
      // Gather org-wide data
      const totalAssets = await this.assetRepo.count({ where: { orgId } });
      const totalScans = await this.scanRepo.count({ where: { orgId } });
      const completedScans = await this.scanRepo.count({
        where: { orgId, status: ScanStatus.COMPLETED },
      });

      // Get severity distribution
      const sevCounts = await this.findingRepo
        .createQueryBuilder('f')
        .innerJoin('f.scan', 's')
        .innerJoin('f.vulnerability', 'v')
        .select('v.severity', 'severity')
        .addSelect('COUNT(f.id)', 'count')
        .where('s.org_id = :orgId', { orgId })
        .groupBy('v.severity')
        .getRawMany<{ severity: string; count: string }>();

      const countMap: Record<string, number> = {};
      for (const r of sevCounts) {
        countMap[r.severity] = parseInt(r.count, 10);
      }

      // Get top vulnerability names
      const topVulns = await this.findingRepo
        .createQueryBuilder('f')
        .innerJoin('f.scan', 's')
        .innerJoin('f.vulnerability', 'v')
        .select('v.name', 'name')
        .addSelect('v.severity', 'severity')
        .addSelect('COUNT(f.id)', 'count')
        .where('s.org_id = :orgId', { orgId })
        .groupBy('v.name')
        .addGroupBy('v.severity')
        .orderBy('count', 'DESC')
        .limit(8)
        .getRawMany<{ name: string; severity: string; count: string }>();

      // Get recent AI analysis scores
      const recentAnalyses = await this.analysisRepo
        .createQueryBuilder('a')
        .innerJoin('a.scan', 's')
        .where('s.org_id = :orgId', { orgId })
        .andWhere('a.status = :status', { status: 'COMPLETED' })
        .orderBy('a.created_at', 'DESC')
        .limit(5)
        .getMany();

      const avgRiskScore =
        recentAnalyses.length > 0
          ? Math.round(
              recentAnalyses.reduce((sum, a) => sum + (a.riskScore ?? 0), 0) /
                recentAnalyses.length,
            )
          : null;

      // Get unscanned assets
      const scannedAssetIds = await this.scanRepo
        .createQueryBuilder('s')
        .select('DISTINCT s.asset_id', 'assetId')
        .where('s.org_id = :orgId', { orgId })
        .andWhere('s.status = :status', { status: ScanStatus.COMPLETED })
        .getRawMany<{ assetId: string }>();

      const unscannedCount = totalAssets - scannedAssetIds.length;

      const prompt = `Analyze this organization's security data and respond with a JSON object.

DATA:
- Total Assets: ${totalAssets}
- Scanned Assets: ${scannedAssetIds.length} / ${totalAssets}
- Unscanned Assets: ${unscannedCount}
- Total Scans: ${totalScans} (${completedScans} completed)
- Critical Findings: ${countMap['CRITICAL'] ?? 0}
- High Findings: ${countMap['HIGH'] ?? 0}
- Medium Findings: ${countMap['MEDIUM'] ?? 0}
- Low Findings: ${countMap['LOW'] ?? 0}
- Average AI Risk Score: ${avgRiskScore ?? 'N/A'}
- Top Vulnerabilities: ${topVulns.map((v) => `${v.name} (${v.severity}, ${v.count}x)`).join(', ') || 'None'}

Respond ONLY with JSON matching this schema:
{
  "summary": "2-3 sentence security posture overview addressing the user directly",
  "priorities": [
    {
      "title": "Short priority title",
      "description": "Why this matters",
      "severity": "critical|high|medium|low",
      "actionable": "Specific action to take"
    }
  ],
  "positiveFeedback": "One encouraging thing about their security stance",
  "riskTrend": "Brief assessment of overall risk direction"
}

Include 2-4 priorities. Be specific and actionable. If there are no findings, congratulate them and suggest scanning more assets.`;

      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
        systemInstruction:
          'You are a cybersecurity advisor providing concise, actionable dashboard insights. Be specific and data-driven.',
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = this.parseJson<DashboardInsight>(text);

      // Cache for 5 minutes
      this.insightsCache.set(orgId, {
        data: parsed,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return parsed;
    } catch (error) {
      this.logger.error(
        `Dashboard insights error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        summary: 'Unable to generate AI insights at this time. Please try again later.',
        priorities: [],
        positiveFeedback: '',
        riskTrend: '',
      };
    }
  }

  async getRemediationGuide(
    findingId: string,
    orgId: string,
  ): Promise<RemediationGuide> {
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp';

    // Load finding with vulnerability
    const finding = await this.findingRepo.findOne({
      where: { id: findingId },
      relations: ['vulnerability', 'scan'],
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // Verify org ownership
    const scan = await this.scanRepo.findOne({
      where: { id: finding.scanId, orgId },
      relations: ['asset'],
    });

    if (!scan) {
      throw new NotFoundException('Finding not found in your organization');
    }

    const v = finding.vulnerability;

    const prompt = `Generate a detailed remediation guide for this vulnerability. Respond ONLY with JSON.

VULNERABILITY:
- Name: ${v.name}
- Severity: ${v.severity}
- Category: ${v.category}
- Description: ${v.description}
- Location: ${finding.location}
- Evidence: ${finding.evidence ?? 'N/A'}
- Target: ${scan.asset?.value ?? 'Unknown'}
- Current Remediation Hint: ${v.remediation}

Respond with JSON matching this schema:
{
  "title": "${v.name}",
  "severity": "${v.severity}",
  "whatIsIt": "Clear explanation of what this vulnerability is, for someone who may not be technical",
  "whyItMatters": "Real-world impact explanation - what could an attacker do?",
  "steps": [
    {
      "step": 1,
      "title": "Step title",
      "description": "Detailed explanation of what to do",
      "code": "actual code snippet or config change if applicable",
      "language": "nginx|apache|javascript|python|bash|yaml|etc"
    }
  ],
  "verification": "How to verify the fix worked",
  "references": ["URL or reference 1", "URL or reference 2"]
}

Provide 3-6 practical steps with real code examples where applicable. Be specific to the technology detected at ${scan.asset?.value ?? 'the target'}.`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
        systemInstruction:
          'You are a senior security engineer providing detailed, practical remediation guides with real code examples. Always be specific and actionable.',
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return this.parseJson<RemediationGuide>(text);
    } catch (error) {
      this.logger.error(
        `Remediation guide error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        title: v.name,
        severity: v.severity,
        whatIsIt: v.description,
        whyItMatters: 'This vulnerability could allow attackers to compromise your system.',
        steps: [
          {
            step: 1,
            title: 'Apply recommended fix',
            description: v.remediation,
          },
        ],
        verification: 'Run another scan to verify the fix.',
        references: [],
      };
    }
  }

  private parseJson<T>(text: string): T {
    let cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]) as T;
      }
      throw new Error('Could not parse JSON from Gemini response');
    }
  }
}
