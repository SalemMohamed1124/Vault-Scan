import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Vulnerability } from '../findings/vulnerability.entity.js';
import { ScanStatus, AssetType } from '../../common/enums/index.js';
import { ScriptRunnerService } from './script-runner.service.js';
import { AggregatorService } from './aggregator.service.js';
import type { AggregatedFinding } from './aggregator.service.js';
import { scanProgressStore } from './scan-progress.store.js';

export interface ScanJobData {
  scanId: string;
  assetId: string;
  assetValue: string;
  assetType: AssetType;
  scanType: 'QUICK' | 'DEEP';
  orgId: string;
  initiatedBy: string;
  cookies?: string;
  customHeaders?: string;
}

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

@Injectable()
export class ScanOrchestratorService {
  private readonly logger = new Logger(ScanOrchestratorService.name);

  constructor(
    @InjectRepository(Scan)
    private readonly scanRepo: Repository<Scan>,
    @InjectRepository(ScanFinding)
    private readonly findingRepo: Repository<ScanFinding>,
    @InjectRepository(Vulnerability)
    private readonly vulnRepo: Repository<Vulnerability>,
    private readonly scriptRunner: ScriptRunnerService,
    private readonly aggregator: AggregatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private getAuthArgs(jobData: ScanJobData): string[] {
    const args: string[] = [];
    if (jobData.cookies) {
      args.push('--cookies', jobData.cookies);
    }
    if (jobData.customHeaders) {
      args.push('--headers', jobData.customHeaders);
    }
    return args;
  }

  async runQuickScan(jobData: ScanJobData): Promise<void> {
    const { scanId, assetValue, assetType } = jobData;
    const authArgs = this.getAuthArgs(jobData);
    const isWebAsset =
      assetType === AssetType.DOMAIN || assetType === AssetType.URL;

    try {
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      this.emitProgress(scanId, 0, 'Starting quick scan');

      const allScriptResults: ScriptFinding[][] = [];
      const QUICK_TIMEOUT = 30000; // 30s max per script for quick scan

      // ── Phase 0: Auth Discovery (0→10%) ──────────────────
      this.emitProgress(scanId, 2, 'Attempting authentication bypass...');

      const authResults = await Promise.allSettled([
        this.scriptRunner.runScript(
          'chk_00_auth_discovery.py',
          ['--target', assetValue, ...authArgs],
          scanId,
          40000,
        ),
      ]);

      const authFindings = this.extractSettledResults(authResults, scanId).flat();
      const authSession = authFindings.find(f => f.vulnerability === '__AUTH_SESSION__');
      const discoveredCookies = authSession?.raw_details?.cookies as string | undefined;

      let scanAuthArgs = [...authArgs];
      if (discoveredCookies && !jobData.cookies) {
        scanAuthArgs = ['--cookies', discoveredCookies, ...authArgs.filter(a => a !== '--cookies')];
        this.emitProgress(scanId, 5, 'Authentication bypass successful — scanning with session');
      }

      const realAuthFindings = authFindings.filter(f => f.vulnerability !== '__AUTH_SESSION__');
      if (realAuthFindings.length > 0) allScriptResults.push(realAuthFindings);

      this.emitProgress(scanId, 10, `Auth phase complete — ${allScriptResults.flat().length} issues`);

      // ── Phase 1: Infrastructure (10→30%) — all parallel ──
      this.emitProgress(scanId, 12, 'Scanning infrastructure: ports, headers, SSL, cookies');

      const phase1Results = await Promise.allSettled([
        this.scriptRunner.runScript('chk_quick.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
        this.scriptRunner.runScript('chk_22_cookie_security.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
        ...(isWebAsset ? [
          this.scriptRunner.runScript('ssl_checker.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
          this.scriptRunner.runScript('chk_19_clickjacking.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
        ] : []),
      ]);
      allScriptResults.push(...this.extractSettledResults(phase1Results, scanId));
      this.emitProgress(scanId, 30, `Infrastructure scan done — ${allScriptResults.flat().length} issues found`);

      // ── Phase 2: Vulnerability Testing (30→70%) — all parallel ──
      if (isWebAsset) {
        this.emitProgress(scanId, 32, 'Testing for SQL injection, XSS, CSRF & CORS');

        const phase2Results = await Promise.allSettled([
          this.scriptRunner.runScript('chk_01_sql.py', ['--target', assetValue, ...scanAuthArgs], scanId, 45000),
          this.scriptRunner.runScript('chk_02_xss.py', ['--target', assetValue, ...scanAuthArgs], scanId, 45000),
          this.scriptRunner.runScript('chk_03_csrf.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
          this.scriptRunner.runScript('chk_41_info_disclosure.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
        ]);
        allScriptResults.push(...this.extractSettledResults(phase2Results, scanId));
      }
      this.emitProgress(scanId, 70, `Vulnerability testing done — ${allScriptResults.flat().length} issues found`);

      // ── Phase 3: Quick security checks (70→90%) ──
      if (isWebAsset) {
        this.emitProgress(scanId, 72, 'Running WAF detection & rate limit checks');

        const phase3Results = await Promise.allSettled([
          this.scriptRunner.runScript('chk_40_waf_detect.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
          this.scriptRunner.runScript('chk_28_rate_limit.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
        ]);
        allScriptResults.push(...this.extractSettledResults(phase3Results, scanId));
      }

      if (assetType === AssetType.DOMAIN) {
        const dnsResults = await Promise.allSettled([
          this.scriptRunner.runScript('chk_10_dns.py', ['--target', assetValue, ...scanAuthArgs], scanId, QUICK_TIMEOUT),
        ]);
        allScriptResults.push(...this.extractSettledResults(dnsResults, scanId));
      }

      this.emitProgress(scanId, 90, `Aggregating ${allScriptResults.flat().length} raw findings`);

      // ── Phase 4: Save results (90→100%) ──
      const aggregated = this.aggregator.aggregate(allScriptResults);
      await this.saveFindings(scanId, aggregated);

      await this.updateScanStatus(scanId, ScanStatus.COMPLETED);
      this.emitProgress(scanId, 100, `Quick scan completed — ${aggregated.length} vulnerabilities found`);

      this.eventEmitter.emit('scan.completed', {
        scanId,
        orgId: jobData.orgId,
        assetId: jobData.assetId,
        findingsCount: aggregated.length,
      });

      this.logger.log(`Quick scan ${scanId} completed with ${aggregated.length} findings`);
    } catch (error) {
      this.logger.error(`Quick scan ${scanId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.updateScanStatus(scanId, ScanStatus.FAILED);
      this.emitProgress(scanId, -1, 'Scan failed');
      throw error;
    }
  }

  async runDeepScan(jobData: ScanJobData): Promise<void> {
    const { scanId, assetValue, assetType } = jobData;
    const authArgs = this.getAuthArgs(jobData);
    const isWebAsset =
      assetType === AssetType.DOMAIN || assetType === AssetType.URL;

    try {
      // Step 1: Update status to RUNNING
      await this.updateScanStatus(scanId, ScanStatus.RUNNING);
      this.emitProgress(scanId, 0, 'Starting deep scan');

      const allScriptResults: ScriptFinding[][] = [];

      // ---------------------------------------------------------------
      // Phase 0: Authentication Discovery
      // ---------------------------------------------------------------
      this.emitProgress(scanId, 1, 'Phase 0: Discovering authentication & attempting login bypass');

      const deepAuthResults = await Promise.allSettled([
        this.scriptRunner.runScript(
          'chk_00_auth_discovery.py',
          ['--target', assetValue, ...authArgs],
          scanId,
          60000,
        ),
      ]);

      const deepAuthExtracted = this.extractSettledResults(deepAuthResults, scanId);
      const deepAuthFindings = deepAuthExtracted.flat();
      const deepAuthSession = deepAuthFindings.find(f => f.vulnerability === '__AUTH_SESSION__');
      const deepCookies = deepAuthSession?.raw_details?.cookies as string | undefined;

      let scanAuthArgs = [...authArgs];
      if (deepCookies && !jobData.cookies) {
        scanAuthArgs = ['--cookies', deepCookies, ...authArgs.filter(a => a !== '--cookies')];
        this.logger.log(`Auth discovery acquired cookies for deep scan ${scanId}`);
        this.emitProgress(scanId, 2, 'Authentication bypass successful — scanning with authenticated session');
      }

      const realDeepAuthFindings = deepAuthFindings.filter(f => f.vulnerability !== '__AUTH_SESSION__');
      if (realDeepAuthFindings.length > 0) {
        allScriptResults.push(realDeepAuthFindings);
      }

      // ---------------------------------------------------------------
      // Phase 1: Network Discovery (3% → 12%)
      // ---------------------------------------------------------------
      this.emitProgress(scanId, 3, 'Phase 1: Port scanning & network discovery');

      // Use common ports instead of --full (65535 ports is too slow)
      const phase1Results = await Promise.allSettled([
        this.scriptRunner.runScript(
          'chk_17_nmap.py',
          ['--target', assetValue, '--ports', '1-1024,3306,5432,6379,8080,8443,9200,27017', ...scanAuthArgs],
          scanId,
          120000,
        ),
      ]);
      const phase1Extracted = this.extractSettledResults(phase1Results, scanId);
      allScriptResults.push(...phase1Extracted);

      this.emitProgress(scanId, 8, 'Port scan complete, fingerprinting services');

      // Extract open ports for fingerprinting
      const nmapFindings = phase1Extracted.flat();
      const openPorts = this.extractOpenPorts(nmapFindings);
      const portsArg =
        openPorts.length > 0 ? openPorts.join(',') : '22,80,443,3306';

      const fingerprintPhase = await Promise.allSettled([
        this.scriptRunner.runScript(
          'service_fingerprint.py',
          ['--target', assetValue, '--ports', portsArg, ...scanAuthArgs],
          scanId,
          120000,
        ),
      ]);
      allScriptResults.push(...this.extractSettledResults(fingerprintPhase, scanId));

      const phase1Count = allScriptResults.flat().length;
      this.emitProgress(scanId, 12, `Phase 1 complete — ${phase1Count} issues found so far`);

      // ---------------------------------------------------------------
      // Phase 1.5: DNS Reconnaissance (12% → 25%)
      // ---------------------------------------------------------------
      if (assetType === AssetType.DOMAIN || assetType === AssetType.URL) {
        this.emitProgress(
          scanId,
          14,
          'Phase 1.5: DNS reconnaissance (subdomain enumeration, DNS config)',
        );

        const dnsScripts: Array<Promise<ScriptFinding[]>> = [
          this.scriptRunner.runScript(
            'chk_09_subdomain.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_10_dns.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            90000,
          ),
        ];

        const dnsResults = await Promise.allSettled(dnsScripts);
        const dnsExtracted = this.extractSettledResults(dnsResults, scanId);
        allScriptResults.push(...dnsExtracted);
      }

      const dnsPhaseCount = allScriptResults.flat().length;
      this.emitProgress(scanId, 25, `DNS reconnaissance complete — ${dnsPhaseCount} issues found so far`);

      // ---------------------------------------------------------------
      // Phase 2a: Injection & Input Validation (25% → 45%)
      // ---------------------------------------------------------------
      if (isWebAsset) {
        this.emitProgress(
          scanId,
          27,
          'Phase 2a: Injection testing (SQL injection, XSS, command injection, SSTI)',
        );

        const injectionResults = await Promise.allSettled([
          this.scriptRunner.runScript(
            'chk_01_sql.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            240000, // 4 min for SQLi (time-based blind is slow)
          ),
          this.scriptRunner.runScript(
            'chk_02_xss.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            180000,
          ),
          this.scriptRunner.runScript(
            'chk_06_cmdi.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            150000,
          ),
          this.scriptRunner.runScript(
            'chk_12_ssti.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            150000,
          ),
          this.scriptRunner.runScript(
            'chk_11_xxe.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            150000,
          ),
        ]);

        allScriptResults.push(...this.extractSettledResults(injectionResults, scanId));
      }

      const injectionPhaseCount = allScriptResults.flat().length;
      this.emitProgress(scanId, 45, `Injection testing complete — ${injectionPhaseCount} issues found so far`);

      // ---------------------------------------------------------------
      // Phase 2b: Access Control & Logic (45% → 60%)
      // ---------------------------------------------------------------
      if (isWebAsset) {
        this.emitProgress(
          scanId,
          47,
          'Phase 2b: Access control testing (CSRF, open redirect, LFI, IDOR, SSRF)',
        );

        const accessResults = await Promise.allSettled([
          this.scriptRunner.runScript(
            'chk_03_csrf.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_04_open_redirect.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_05_lfi.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            150000,
          ),
          this.scriptRunner.runScript(
            'chk_14_idor.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_13_ssrf.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            150000,
          ),
        ]);

        allScriptResults.push(...this.extractSettledResults(accessResults, scanId));
      }

      const accessPhaseCount = allScriptResults.flat().length;
      this.emitProgress(scanId, 60, `Access control testing complete — ${accessPhaseCount} issues found so far`);

      // ---------------------------------------------------------------
      // Phase 2c: Protocol & Header attacks (60% → 70%)
      // ---------------------------------------------------------------
      if (isWebAsset) {
        this.emitProgress(
          scanId,
          62,
          'Phase 2c: CORS, clickjacking, CRLF, host header, cookie & protocol attacks',
        );

        const phase2cResults = await Promise.allSettled([
          this.scriptRunner.runScript(
            'chk_15_http_smuggling.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            90000,
          ),
          this.scriptRunner.runScript(
            'chk_16_cors.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_19_clickjacking.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            30000,
          ),
          this.scriptRunner.runScript(
            'chk_20_crlf.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_21_host_header.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_22_cookie_security.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            30000,
          ),
          this.scriptRunner.runScript(
            'chk_23_jwt.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_24_graphql.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_25_dir_listing.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_26_file_upload.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            90000,
          ),
          this.scriptRunner.runScript(
            'chk_27_broken_auth.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_28_rate_limit.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            90000,
          ),
          this.scriptRunner.runScript(
            'chk_29_websocket.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_30_http_param_pollution.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_31_cache_poison.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_32_network_services.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_33_nosql_injection.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_34_ldap_injection.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            90000,
          ),
          this.scriptRunner.runScript(
            'chk_35_deserialization.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_36_cloud_storage.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            90000,
          ),
          this.scriptRunner.runScript(
            'chk_37_subdomain_takeover.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'chk_38_prototype_pollution.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_39_email_security.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_40_waf_detect.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
          this.scriptRunner.runScript(
            'chk_41_info_disclosure.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            90000,
          ),
          this.scriptRunner.runScript(
            'chk_42_csv_injection.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
        ]);

        allScriptResults.push(...this.extractSettledResults(phase2cResults, scanId));
      }

      const phase2Count = allScriptResults.flat().length;
      this.emitProgress(scanId, 70, `Phase 2 complete — ${phase2Count} issues found so far`);

      // ---------------------------------------------------------------
      // Phase 3: Configuration & Data Exposure (70% → 90%)
      // ---------------------------------------------------------------
      this.emitProgress(
        scanId,
        72,
        'Phase 3: Security configuration, data exposure, and SSL/TLS analysis',
      );

      const phase3Scripts: Array<Promise<ScriptFinding[]>> = [
        this.scriptRunner.runScript(
          'chk_quick.py',
          ['--target', assetValue, ...scanAuthArgs],
          scanId,
          60000,
        ),
      ];

      if (isWebAsset) {
        phase3Scripts.push(
          this.scriptRunner.runScript(
            'chk_07_misconfig.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            150000,
          ),
          this.scriptRunner.runScript(
            'chk_08_sensitive_data.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            120000,
          ),
          this.scriptRunner.runScript(
            'ssl_checker.py',
            ['--target', assetValue, ...scanAuthArgs],
            scanId,
            60000,
          ),
        );
      }

      const phase3Results = await Promise.allSettled(phase3Scripts);
      const phase3Extracted = this.extractSettledResults(
        phase3Results,
        scanId,
      );
      allScriptResults.push(...phase3Extracted);

      const totalRawDeep = allScriptResults.flat().length;
      this.emitProgress(scanId, 90, `Phase 3 complete — ${totalRawDeep} issues found so far`);

      // ---------------------------------------------------------------
      // Phase 4: Aggregation & Save (90% → 100%)
      // ---------------------------------------------------------------
      this.emitProgress(scanId, 92, `Aggregating ${totalRawDeep} raw findings`);

      const aggregated = this.aggregator.aggregate(allScriptResults);
      await this.saveFindings(scanId, aggregated);

      // Complete
      await this.updateScanStatus(scanId, ScanStatus.COMPLETED);
      this.emitProgress(scanId, 100, 'Deep scan completed');

      this.eventEmitter.emit('scan.completed', {
        scanId,
        orgId: jobData.orgId,
        assetId: jobData.assetId,
        findingsCount: aggregated.length,
      });

      this.logger.log(
        `Deep scan ${scanId} completed with ${aggregated.length} findings`,
      );
    } catch (error) {
      this.logger.error(
        `Deep scan ${scanId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      await this.updateScanStatus(scanId, ScanStatus.FAILED);
      this.emitProgress(scanId, -1, 'Scan failed');
      throw error;
    }
  }

  private extractSettledResults(
    results: PromiseSettledResult<ScriptFinding[]>[],
    scanId: string,
  ): ScriptFinding[][] {
    const extracted: ScriptFinding[][] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        extracted.push(result.value);
      } else {
        this.logger.warn(
          `Script failed during scan ${scanId}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`,
        );
        // Continue with other results — don't fail the entire scan
      }
    }

    return extracted;
  }

  private extractOpenPorts(nmapResults: ScriptFinding[]): string[] {
    const ports: string[] = [];

    for (const finding of nmapResults) {
      const rawDetails = finding.raw_details;
      if (rawDetails && typeof rawDetails['port'] === 'number') {
        ports.push(String(rawDetails['port']));
      }
    }

    return ports;
  }

  private async saveFindings(
    scanId: string,
    findings: AggregatedFinding[],
  ): Promise<void> {
    for (const finding of findings) {
      try {
        // Find or create vulnerability
        let vulnerability = await this.vulnRepo.findOne({
          where: {
            name: finding.vulnerabilityName,
            severity: finding.severity,
          },
        });

        if (!vulnerability) {
          vulnerability = this.vulnRepo.create({
            name: finding.vulnerabilityName,
            severity: finding.severity,
            description: this.getDefaultDescription(
              finding.vulnerabilityName,
              finding.category,
            ),
            remediation: this.getDefaultRemediation(
              finding.category,
              finding.severity,
            ),
            category: finding.category,
            cveId: finding.cveId,
          });
          vulnerability = await this.vulnRepo.save(vulnerability);
        }

        // Create scan finding
        const scanFinding = this.findingRepo.create({
          scanId,
          vulnId: vulnerability.id,
          evidence: finding.evidence,
          location: finding.location,
          rawOutput: finding.rawOutput,
        });

        await this.findingRepo.save(scanFinding);
      } catch (error) {
        this.logger.error(
          `Failed to save finding "${finding.vulnerabilityName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private getDefaultDescription(
    vulnerabilityName: string,
    category: string,
  ): string {
    const descriptions: Record<string, string> = {
      AUTH_DISCOVERY:
        'A login form or authentication endpoint was detected on the target. Authentication endpoints are common targets for brute force, credential stuffing, and bypass attacks.',
      INJECTION:
        'An injection vulnerability was detected. Injection flaws allow attackers to send malicious data to an interpreter, potentially executing unintended commands or accessing data without authorization.',
      XSS:
        'A Cross-Site Scripting (XSS) vulnerability was detected. XSS allows attackers to inject client-side scripts into web pages viewed by other users.',
      CSRF:
        'A Cross-Site Request Forgery (CSRF) vulnerability was detected. CSRF tricks authenticated users into unknowingly submitting malicious requests.',
      OPEN_REDIRECT:
        'An open redirect vulnerability was detected. Attackers can exploit this to redirect users to malicious sites, facilitating phishing attacks.',
      LFI:
        'A Local File Inclusion (LFI) vulnerability was detected. This may allow attackers to read sensitive files from the server.',
      MISCONFIGURATION:
        'A security misconfiguration was detected. Misconfigurations are the most common security issue and can expose sensitive data or allow unauthorized access.',
      CORS:
        'A Cross-Origin Resource Sharing (CORS) misconfiguration was detected. Improper CORS settings can allow unauthorized cross-origin requests.',
      COOKIE_SECURITY:
        'Insecure cookie attributes were detected. Cookies without proper security flags are vulnerable to theft via XSS or interception.',
      DNS:
        'A DNS security issue was detected. DNS misconfigurations can facilitate domain hijacking, email spoofing, or zone transfer attacks.',
      SSRF:
        'A Server-Side Request Forgery (SSRF) vulnerability was detected. SSRF allows attackers to induce the server to make requests to unintended locations.',
      ACCESS_CONTROL:
        'An access control weakness was detected. Improper access controls can allow attackers to access resources or perform actions beyond their authorization.',
      SSL_TLS:
        'An SSL/TLS security issue was detected. Weak or misconfigured TLS can expose encrypted communications to interception or downgrade attacks.',
      HTTP_SECURITY:
        'A missing or misconfigured HTTP security header was detected. Security headers protect against common web attacks such as XSS, clickjacking, and information disclosure.',
      INFORMATION_DISCLOSURE:
        'Sensitive information disclosure was detected. Exposed data may assist attackers in fingerprinting the application or discovering further vulnerabilities.',
      NETWORK:
        'A network-level security issue was detected. Exposed services or open ports may provide attack vectors for unauthorized access.',
      SERVICE_VERSION:
        'An outdated or vulnerable service version was detected. Unpatched software versions may contain known vulnerabilities with public exploits.',
    };

    return (
      descriptions[category] ||
      `${vulnerabilityName} was detected on the target. Review the vulnerability evidence for details and apply appropriate remediation.`
    );
  }

  private getDefaultRemediation(
    category: string,
    severity: string,
  ): string {
    const remediations: Record<string, string> = {
      NETWORK:
        'Review exposed ports and close unnecessary ones. Use firewall rules to restrict access.',
      HTTP_SECURITY:
        'Add the recommended security headers to your web server configuration.',
      INFORMATION_DISCLOSURE:
        'Remove or restrict access to sensitive files and directories. Ensure error pages do not reveal stack traces or internal paths.',
      INJECTION:
        'Use parameterized queries and input validation to prevent injection attacks. Never construct queries or commands from raw user input.',
      XSS:
        'Implement output encoding and Content-Security-Policy headers. Sanitize all user-controlled data before rendering in HTML.',
      SSL_TLS:
        'Update SSL/TLS configuration. Use TLS 1.2+ and strong cipher suites.',
      SERVICE_VERSION:
        'Update the affected service to the latest stable version.',
      CSRF:
        'Implement anti-CSRF tokens in all state-changing forms. Use the SameSite cookie attribute set to Lax or Strict.',
      OPEN_REDIRECT:
        'Validate and whitelist redirect URLs. Never use user input directly in redirect targets. Use relative paths where possible.',
      LFI:
        'Sanitize file path inputs. Use allowlists for permitted files. Disable directory traversal in web server configuration.',
      MISCONFIGURATION:
        'Remove default credentials. Disable debug mode in production. Restrict access to admin panels and management interfaces.',
      CORS:
        'Configure CORS to allow only trusted origins. Never reflect arbitrary Origin headers. Avoid Access-Control-Allow-Origin: *.',
      COOKIE_SECURITY:
        'Set Secure, HttpOnly, and SameSite attributes on all cookies. Use __Host- or __Secure- cookie prefixes where possible.',
      DNS:
        'Implement SPF, DKIM, and DMARC records. Disable zone transfers to unauthorized servers. Monitor subdomain registrations.',
      SSRF:
        'Validate and sanitize all URL inputs. Use allowlists for permitted destinations. Block requests to internal networks and cloud metadata endpoints.',
      ACCESS_CONTROL:
        'Implement proper authorization checks for all resource access. Use unpredictable identifiers (UUIDs). Verify user permissions server-side for every request.',
    };

    return (
      remediations[category] ||
      `Review and remediate this ${severity.toLowerCase()} severity finding.`
    );
  }

  private async updateScanStatus(
    scanId: string,
    status: ScanStatus,
  ): Promise<void> {
    const update: Record<string, unknown> = { status };

    if (status === ScanStatus.RUNNING) {
      update['startedAt'] = new Date();
    }

    if (
      status === ScanStatus.COMPLETED ||
      status === ScanStatus.FAILED ||
      status === ScanStatus.CANCELLED
    ) {
      update['completedAt'] = new Date();
    }

    await this.scanRepo.update(scanId, update);
  }

  private emitProgress(
    scanId: string,
    progress: number,
    phase: string,
  ): void {
    this.logger.log(`[PROGRESS] scan=${scanId} progress=${progress} phase="${phase}"`);
    // Write to shared in-memory store (reliable, polled by SSE controller)
    scanProgressStore.set(scanId, progress, phase);
    // Also emit event (for any listeners)
    this.eventEmitter.emit('scan.progress', { scanId, progress, phase });
  }
}
