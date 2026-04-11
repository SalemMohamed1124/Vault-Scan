import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  async generatePdf(data: ReportData): Promise<Buffer> {
    // Dynamic import to avoid issues if puppeteer is not installed
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
      const page = await browser.newPage();

      // Load template and inject data
      const templatePath = path.join(__dirname, 'templates', 'scan-report.html');
      const template = fs.readFileSync(templatePath, 'utf-8');
      const html = this.renderTemplate(template, data);

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });

      this.logger.log(`PDF generated for scan ${data.scan.id}`);
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  renderHtmlReport(data: ReportData): string {
    const templatePath = path.join(__dirname, 'templates', 'scan-report.html');
    const template = fs.readFileSync(templatePath, 'utf-8');
    return this.renderTemplate(template, data);
  }

  private renderTemplate(template: string, data: ReportData): string {
    let html = template;

    // Simple replacements
    html = html.replace(/\{\{ASSET_NAME\}\}/g, this.escapeHtml(data.asset.name));
    html = html.replace(/\{\{ASSET_VALUE\}\}/g, this.escapeHtml(data.asset.value));
    html = html.replace(/\{\{ASSET_TYPE\}\}/g, this.escapeHtml(data.asset.type));
    html = html.replace(/\{\{SCAN_TYPE\}\}/g, this.escapeHtml(data.scan.type));
    html = html.replace(/\{\{SCAN_ID\}\}/g, this.escapeHtml(data.scan.id));
    html = html.replace(/\{\{GENERATED_AT\}\}/g, this.escapeHtml(data.generatedAt));
    html = html.replace(/\{\{ORG_NAME\}\}/g, this.escapeHtml(data.organization.name));

    // Risk score
    const riskScore = data.aiAnalysis?.riskScore ?? 0;
    const riskLevel = data.aiAnalysis?.riskLevel ?? 'LOW';
    html = html.replace(/\{\{RISK_SCORE\}\}/g, String(riskScore));
    html = html.replace(/\{\{RISK_LEVEL\}\}/g, riskLevel);
    html = html.replace(/\{\{TOTAL_FINDINGS\}\}/g, String(data.findings.summary.total));

    // Executive summary
    const summary = data.aiAnalysis?.executiveSummary || 'No AI analysis available.';
    html = html.replace(/\{\{EXECUTIVE_SUMMARY\}\}/g, this.escapeHtml(summary));

    // Severity counts
    html = html.replace(/\{\{CRITICAL_COUNT\}\}/g, String(data.findings.summary.critical));
    html = html.replace(/\{\{HIGH_COUNT\}\}/g, String(data.findings.summary.high));
    html = html.replace(/\{\{MEDIUM_COUNT\}\}/g, String(data.findings.summary.medium));
    html = html.replace(/\{\{LOW_COUNT\}\}/g, String(data.findings.summary.low));

    // Key findings section
    html = html.replace(/\{\{KEY_FINDINGS_SECTION\}\}/g, this.buildKeyFindingsSection(data));

    // Findings table
    html = html.replace(/\{\{FINDINGS_TABLE\}\}/g, this.buildFindingsTable(data));

    // Recommendations section
    html = html.replace(
      /\{\{RECOMMENDATIONS_SECTION\}\}/g,
      this.buildRecommendationsSection(data),
    );

    // Technical details
    const techDetails = data.aiAnalysis?.technicalDetails || 'No technical details available.';
    html = html.replace(/\{\{TECHNICAL_DETAILS\}\}/g, this.escapeHtml(techDetails));

    // Compliance section
    html = html.replace(/\{\{COMPLIANCE_SECTION\}\}/g, this.buildComplianceSection(data));

    return html;
  }

  private buildKeyFindingsSection(data: ReportData): string {
    const findings = data.aiAnalysis?.keyFindings;
    if (!findings || findings.length === 0) {
      return '<div class="no-data">No key findings from AI analysis.</div>';
    }

    const items = findings
      .map(
        (f) => `
      <div class="key-finding">
        <div class="title">${this.escapeHtml(f.title)}</div>
        <div class="detail"><strong>Impact:</strong> ${this.escapeHtml(f.impact)}</div>
        <div class="detail"><strong>Likelihood:</strong> ${this.escapeHtml(f.likelihood)}</div>
      </div>`,
      )
      .join('');

    return `<h2 class="section-title">Key Findings</h2>${items}`;
  }

  private buildFindingsTable(data: ReportData): string {
    if (data.findings.items.length === 0) {
      return '<div class="no-data">No vulnerabilities detected.</div>';
    }

    const rows = data.findings.items
      .map(
        (f, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${this.escapeHtml(f.vulnerability)}</td>
        <td><span class="badge badge-${f.severity}">${f.severity}</span></td>
        <td>${this.escapeHtml(f.category)}</td>
        <td>${this.escapeHtml(f.location)}</td>
        <td>${this.escapeHtml(f.evidence)}</td>
      </tr>`,
      )
      .join('');

    return `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Vulnerability</th>
          <th>Severity</th>
          <th>Category</th>
          <th>Location</th>
          <th>Evidence</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private buildRecommendationsSection(data: ReportData): string {
    const recs = data.aiAnalysis?.recommendations;
    if (!recs || recs.length === 0) {
      return '<div class="no-data">No recommendations available.</div>';
    }

    const sorted = [...recs].sort((a, b) => a.priority - b.priority);
    return sorted
      .map(
        (r) => `
      <div class="recommendation">
        <span class="priority">P${r.priority}</span>
        <span class="action">${this.escapeHtml(r.action)}</span>
        <div class="rationale">${this.escapeHtml(r.rationale)}</div>
        <span class="effort-tag">Effort: ${this.escapeHtml(r.effort)}</span>
      </div>`,
      )
      .join('');
  }

  private buildComplianceSection(data: ReportData): string {
    const notes = data.aiAnalysis?.complianceNotes;
    if (!notes) {
      return '';
    }

    return `
    <h2 class="section-title">Compliance Notes</h2>
    <div class="summary-text">${this.escapeHtml(notes)}</div>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
