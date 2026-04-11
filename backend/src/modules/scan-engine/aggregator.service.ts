import { Injectable, Logger } from '@nestjs/common';
import { SeverityLevel } from '../../common/enums/index.js';

interface ScriptFinding {
  vulnerability: string;
  severity: string;
  location: string;
  evidence: string;
  category?: string;
  cve_id?: string | null;
  raw_details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AggregatedFinding {
  vulnerabilityName: string;
  severity: SeverityLevel;
  location: string;
  evidence: string;
  category: string;
  cveId: string | null;
  rawOutput: string;
}

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);

  aggregate(scriptResults: ScriptFinding[][]): AggregatedFinding[] {
    const allFindings = scriptResults.flat();

    this.logger.log(
      `Aggregating ${allFindings.length} findings from ${scriptResults.length} scripts`,
    );

    const aggregated = allFindings.map((finding) => ({
      vulnerabilityName: finding.vulnerability || 'Unknown Vulnerability',
      severity: this.normalizeSeverity(finding.severity),
      location: finding.location || 'unknown',
      evidence: finding.evidence || '',
      category: finding.category || 'GENERAL',
      cveId: finding.cve_id || null,
      rawOutput: JSON.stringify(finding.raw_details || {}),
    }));

    // Deduplicate by vulnerability name + location
    const seen = new Set<string>();
    const deduplicated: AggregatedFinding[] = [];

    for (const finding of aggregated) {
      const key = `${finding.vulnerabilityName}::${finding.location}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(finding);
      }
    }

    this.logger.log(
      `After deduplication: ${deduplicated.length} unique findings`,
    );

    return deduplicated;
  }

  normalizeSeverity(severity: string): SeverityLevel {
    const map: Record<string, SeverityLevel> = {
      CRITICAL: SeverityLevel.CRITICAL,
      HIGH: SeverityLevel.HIGH,
      MEDIUM: SeverityLevel.MEDIUM,
      LOW: SeverityLevel.LOW,
      INFO: SeverityLevel.LOW,
    };

    return map[severity?.toUpperCase()] || SeverityLevel.LOW;
  }
}
