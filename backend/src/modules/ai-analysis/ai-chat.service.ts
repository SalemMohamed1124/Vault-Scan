import { Inject, Injectable, Logger } from '@nestjs/common';
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

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

  async chat(
    orgId: string,
    message: string,
    history: ChatMessage[],
    scanId?: string,
  ): Promise<{ reply: string }> {
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp';

    try {
      // Build context from org data
      const context = await this.buildContext(orgId, scanId);

      const systemPrompt = `You are VaultScan AI, an expert cybersecurity assistant embedded in a vulnerability scanning platform. You help users understand their security posture, explain vulnerabilities, and provide actionable remediation advice.

IMPORTANT RULES:
- Be concise but thorough. Use bullet points and markdown formatting.
- When discussing vulnerabilities, explain the risk in plain language AND provide technical remediation steps.
- If you reference a CVE, briefly explain what it is.
- If the user asks about something outside your context data, say so honestly.
- Always be encouraging - security is a journey, not a destination.
- Respond in the same language the user writes in (e.g., if they write in Arabic, respond in Arabic).

CURRENT SECURITY CONTEXT:
${context}`;

      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        systemInstruction: systemPrompt,
      });

      // Build chat history
      const chatHistory = history.map((msg) => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({ history: chatHistory });
      const result = await chat.sendMessage(message);
      const reply = result.response.text();

      return { reply };
    } catch (error) {
      this.logger.error(
        `Chat error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        reply:
          'I apologize, but I encountered an error processing your request. Please try again in a moment.',
      };
    }
  }

  private async buildContext(orgId: string, scanId?: string): Promise<string> {
    const parts: string[] = [];

    // If a specific scan is referenced, load its details
    if (scanId) {
      const scan = await this.scanRepo.findOne({
        where: { id: scanId, orgId },
        relations: ['asset'],
      });

      if (scan) {
        const findings = await this.findingRepo.find({
          where: { scanId },
          relations: ['vulnerability'],
          order: { createdAt: 'ASC' },
        });

        const analysis = await this.analysisRepo.findOne({
          where: { scanId },
        });

        parts.push(`CURRENT SCAN (${scan.id}):`);
        parts.push(`- Asset: ${scan.asset?.name} (${scan.asset?.value})`);
        parts.push(`- Type: ${scan.type} | Status: ${scan.status}`);
        parts.push(`- Total Findings: ${findings.length}`);

        if (findings.length > 0) {
          parts.push('\nFINDINGS:');
          findings.forEach((f) => {
            parts.push(
              `  - [${f.vulnerability.severity}] ${f.vulnerability.name} at ${f.location}`,
            );
            if (f.evidence) {
              parts.push(`    Evidence: ${f.evidence.slice(0, 200)}`);
            }
            parts.push(`    Remediation: ${f.vulnerability.remediation}`);
          });
        }

        if (analysis?.status === 'COMPLETED') {
          parts.push(`\nAI ANALYSIS SUMMARY:`);
          parts.push(`- Risk Score: ${analysis.riskScore}/100 (${analysis.riskLevel})`);
          if (analysis.analysisText) {
            parts.push(`- Summary: ${analysis.analysisText}`);
          }
        }
      }
    }

    // Always include org-wide stats summary
    const totalAssets = await this.assetRepo.count({ where: { orgId } });
    const totalScans = await this.scanRepo.count({ where: { orgId } });
    const completedScans = await this.scanRepo.count({
      where: { orgId, status: ScanStatus.COMPLETED },
    });

    const criticalFindings = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoin('f.vulnerability', 'v')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('v.severity = :sev', { sev: 'CRITICAL' })
      .getCount();

    const highFindings = await this.findingRepo
      .createQueryBuilder('f')
      .innerJoin('f.scan', 's')
      .innerJoin('f.vulnerability', 'v')
      .where('s.org_id = :orgId', { orgId })
      .andWhere('v.severity = :sev', { sev: 'HIGH' })
      .getCount();

    parts.push(`\nORGANIZATION OVERVIEW:`);
    parts.push(`- Total Assets: ${totalAssets}`);
    parts.push(`- Total Scans: ${totalScans} (${completedScans} completed)`);
    parts.push(`- Critical Findings: ${criticalFindings}`);
    parts.push(`- High Findings: ${highFindings}`);

    return parts.join('\n');
  }
}
