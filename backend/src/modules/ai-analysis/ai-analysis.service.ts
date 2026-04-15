import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIAnalysis } from './ai-analysis.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { AIAnalysisStatus, RiskLevel } from '../../common/enums/index.js';
import { PromptBuilderService } from './prompt-builder.service.js';
import { GEMINI_CLIENT } from '../../config/gemini.config.js';
import type { GeminiAnalysisResult } from './dto/ai-analysis-response.dto.js';

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    @InjectRepository(AIAnalysis)
    private readonly analysisRepo: Repository<AIAnalysis>,
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
    @Inject(GEMINI_CLIENT)
    private readonly genAI: GoogleGenerativeAI,
    private readonly configService: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('scan.completed')
  handleScanCompleted(payload: { scanId: string }): void {
    // Run async, don't await — analysis runs in background
    this.analyzeScan(payload.scanId).catch((err: unknown) =>
      this.logger.error(
        `Background AI analysis error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    );
  }

  async analyzeScan(scanId: string): Promise<void> {
    const geminiModel =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp';

    // 1. Create initial record with PROCESSING status
    const analysis = this.analysisRepo.create({
      scanId,
      status: AIAnalysisStatus.PROCESSING,
      geminiModel,
    });
    const savedAnalysis = await this.analysisRepo.save(analysis);

    try {
      // 2. Load scan with asset and findings
      const scan = await this.loadScanWithContext(scanId);

      // 3. Build prompt
      const systemPrompt = this.promptBuilder.buildSystemPrompt();
      const userPrompt = this.promptBuilder.buildAnalysisPrompt(
        scan,
        scan.asset,
        scan.findings,
      );

      // 4. Call Gemini
      const result = await this.callGemini(
        geminiModel,
        systemPrompt,
        userPrompt,
      );

      // 5. Parse and validate response
      const parsed = this.parseGeminiResponse(result.text);

      // 6. Map riskLevel string to enum
      const riskLevel = this.mapRiskLevel(parsed.riskLevel);

      // 7. Update analysis record using save to handle JSONB columns
      savedAnalysis.status = AIAnalysisStatus.COMPLETED;
      savedAnalysis.riskScore = parsed.riskScore;
      savedAnalysis.riskLevel = riskLevel;
      savedAnalysis.analysisText = parsed.executiveSummary;
      savedAnalysis.recommendations =
        parsed.recommendations as unknown as Record<string, unknown>[];
      savedAnalysis.keyFindings =
        parsed.keyFindings as unknown as Record<string, unknown>[];
      savedAnalysis.attackVectors = parsed.attackVectors;
      savedAnalysis.technicalDetails = parsed.technicalDetails;
      savedAnalysis.complianceNotes = parsed.complianceNotes;
      savedAnalysis.promptTokens = result.promptTokens;
      savedAnalysis.completionTokens = result.completionTokens;
      await this.analysisRepo.save(savedAnalysis);

      // 8. Emit event for notification
      this.eventEmitter.emit('ai.analysis.completed', {
        scanId,
        riskScore: parsed.riskScore,
      });

      this.logger.log(
        `AI analysis completed for scan ${scanId} — risk score: ${parsed.riskScore}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      savedAnalysis.status = AIAnalysisStatus.FAILED;
      savedAnalysis.errorMessage = errorMessage;
      await this.analysisRepo.save(savedAnalysis);

      this.logger.error(`AI analysis failed for scan ${scanId}: ${errorMessage}`);
      // Do NOT rethrow — analysis failure should not break the app
    }
  }

  async getAnalysis(scanId: string, orgId: string): Promise<AIAnalysis> {
    // Verify scan belongs to org
    const scan = await this.scanRepo.findOne({
      where: { id: scanId, orgId },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const analysis = await this.analysisRepo.findOne({
      where: { scanId },
    });

    if (!analysis) {
      throw new NotFoundException(
        'AI analysis not found. It may still be processing.',
      );
    }

    // Legacy data handling: flatten objects back to strings if necessary
    if (analysis.attackVectors && Array.isArray(analysis.attackVectors)) {
      analysis.attackVectors = (analysis.attackVectors as any[]).map((v) =>
        typeof v === 'string' ? v : (v.vector || JSON.stringify(v)),
      );
    }

    return analysis;
  }

  async retryAnalysis(scanId: string, orgId: string): Promise<{ message: string }> {
    const scan = await this.scanRepo.findOne({ where: { id: scanId, orgId } });
    if (!scan) throw new NotFoundException('Scan not found');

    // Delete existing failed analysis
    const existing = await this.analysisRepo.findOne({ where: { scanId } });
    if (existing) {
      await this.analysisRepo.remove(existing);
    }

    // Re-run analysis in background
    this.analyzeScan(scanId).catch((err: unknown) =>
      this.logger.error(
        `Retry AI analysis error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    );

    return { message: 'AI analysis retry started' };
  }

  private async loadScanWithContext(scanId: string): Promise<
    Scan & { asset: NonNullable<Scan['asset']>; findings: ScanFinding[] }
  > {
    const scan = await this.scanRepo.findOne({
      where: { id: scanId },
      relations: ['asset'],
    });

    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    if (!scan.asset) {
      throw new Error(`Asset not found for scan ${scanId}`);
    }

    // Load findings with vulnerability details
    const findings = await this.findingRepo.find({
      where: { scanId },
      relations: ['vulnerability'],
      order: { createdAt: 'ASC' },
    });

    return Object.assign(scan, { findings }) as Scan & {
      asset: NonNullable<Scan['asset']>;
      findings: ScanFinding[];
    };
  }

  private async callGemini(
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    text: string;
    promptTokens: number | null;
    completionTokens: number | null;
  }> {
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const text = response.text();

    const usage = response.usageMetadata;

    return {
      text,
      promptTokens: usage?.promptTokenCount ?? null,
      completionTokens: usage?.candidatesTokenCount ?? null,
    };
  }

  parseGeminiResponse(text: string): GeminiAnalysisResult {
    // 1. Strip ALL markdown fences anywhere in the text
    let cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // 2. Parse JSON with multiple fallback strategies
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      // Strategy 1: Extract first { ... } block
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as Record<string, unknown>;
        } catch {
          // Strategy 2: Fix common JSON issues (trailing commas, truncation)
          let fixedJson = match[0]
            .replace(/,\s*([}\]])/g, '$1')  // Remove trailing commas
            .replace(/[\r\n]+/g, ' ');       // Normalize whitespace

          // Strategy 3: If JSON is truncated, try to close it
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;
          const openBrackets = (fixedJson.match(/\[/g) || []).length;
          const closeBrackets = (fixedJson.match(/\]/g) || []).length;

          // Close any unclosed arrays/objects
          for (let i = 0; i < openBrackets - closeBrackets; i++) fixedJson += ']';
          for (let i = 0; i < openBraces - closeBraces; i++) fixedJson += '}';

          try {
            parsed = JSON.parse(fixedJson) as Record<string, unknown>;
          } catch {
            throw new Error('Could not extract JSON from Gemini response');
          }
        }
      } else {
        throw new Error('Could not extract JSON from Gemini response');
      }
    }

    // 3. Validate and normalize required fields
    let riskScore = parsed['riskScore'];
    if (typeof riskScore !== 'number') {
      riskScore = 0;
    }
    riskScore = Math.max(0, Math.min(100, riskScore as number));

    let riskLevel = parsed['riskLevel'] as string | undefined;
    if (
      !riskLevel ||
      !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(riskLevel)
    ) {
      const score = riskScore as number;
      riskLevel =
        score >= 75
          ? 'CRITICAL'
          : score >= 50
            ? 'HIGH'
            : score >= 25
              ? 'MEDIUM'
              : 'LOW';
    }

    return {
      executiveSummary:
        (parsed['executiveSummary'] as string) || 'No summary available.',
      riskScore: riskScore as number,
      riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      keyFindings: Array.isArray(parsed['keyFindings'])
        ? (parsed['keyFindings'] as GeminiAnalysisResult['keyFindings'])
        : [],
      recommendations: Array.isArray(parsed['recommendations'])
        ? (parsed['recommendations'] as GeminiAnalysisResult['recommendations'])
        : [],
      technicalDetails:
        (parsed['technicalDetails'] as string) || '',
      attackVectors: Array.isArray(parsed['attackVectors'])
        ? (parsed['attackVectors'] as string[])
        : [],
      complianceNotes:
        (parsed['complianceNotes'] as string) || '',
    };
  }

  private mapRiskLevel(
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  ): RiskLevel {
    const map: Record<string, RiskLevel> = {
      LOW: RiskLevel.LOW,
      MEDIUM: RiskLevel.MEDIUM,
      HIGH: RiskLevel.HIGH,
      CRITICAL: RiskLevel.CRITICAL,
    };
    return map[level] || RiskLevel.LOW;
  }
}
