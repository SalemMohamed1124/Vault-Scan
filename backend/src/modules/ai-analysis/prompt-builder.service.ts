import { Injectable } from '@nestjs/common';
import { Scan } from '../scans/scan.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';

@Injectable()
export class PromptBuilderService {
  buildSystemPrompt(): string {
    return `You are an expert cybersecurity analyst with deep knowledge of OWASP Top 10, CVE database, and penetration testing. Analyze vulnerability scan results and provide a comprehensive, actionable security assessment. Be specific about risk impact and provide concrete remediation steps. Always respond with valid JSON only.`;
  }

  buildAnalysisPrompt(
    scan: Scan,
    asset: Asset,
    findings: ScanFinding[],
  ): string {
    const findingsList = findings
      .map(
        (f) =>
          `- [${f.vulnerability.severity}] ${f.vulnerability.name}: ${f.evidence} at ${f.location}`,
      )
      .join('\n');

    const scanTypeDescription =
      scan.type === 'QUICK'
        ? 'Port scan + basic checks'
        : 'Full deep scan: ports, SQLi, XSS, SSL, fingerprinting';

    const duration = this.formatDuration(scan.startedAt, scan.completedAt);

    return `Analyze this vulnerability scan report and respond with a JSON object.

ASSET INFORMATION:
- Name: ${asset.name}
- Type: ${asset.type}
- Target: ${asset.value}

SCAN INFORMATION:
- Scan Type: ${scan.type} (${scanTypeDescription})
- Total Findings: ${findings.length}
- Scan Duration: ${duration}

FINDINGS:
${findingsList || 'No vulnerabilities detected.'}

Respond ONLY with a JSON object matching this exact schema:
{
  "executiveSummary": "2-3 sentence overall security assessment",
  "riskScore": <integer 0-100>,
  "riskLevel": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "keyFindings": [
    {
      "title": "Finding name",
      "impact": "What an attacker could do with this",
      "likelihood": "How easy it is to exploit"
    }
  ],
  "recommendations": [
    {
      "priority": <1-5>,
      "action": "Specific action to take",
      "rationale": "Why this matters",
      "effort": "<LOW|MEDIUM|HIGH>"
    }
  ],
  "technicalDetails": "Detailed technical analysis paragraph",
  "attackVectors": ["Possible attack vector 1", "Possible attack vector 2"],
  "complianceNotes": "OWASP/CVE/compliance references if applicable"
}`;
  }

  private formatDuration(
    startedAt: Date | null,
    completedAt: Date | null,
  ): string {
    if (!startedAt || !completedAt) {
      return 'N/A';
    }

    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const seconds = Math.floor(durationMs / 1000);

    if (seconds < 60) {
      return `${seconds} seconds`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}
