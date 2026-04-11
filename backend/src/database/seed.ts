import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from '../modules/users/user.entity.js';
import { Organization } from '../modules/organizations/organization.entity.js';
import { OrganizationMember } from '../modules/organizations/organization-member.entity.js';
import { Asset } from '../modules/assets/asset.entity.js';
import { Scan } from '../modules/scans/scan.entity.js';
import { Vulnerability } from '../modules/findings/vulnerability.entity.js';
import { ScanFinding } from '../modules/findings/scan-finding.entity.js';
import { AIAnalysis } from '../modules/ai-analysis/ai-analysis.entity.js';
import { ScanSchedule } from '../modules/schedules/scan-schedule.entity.js';
import { Notification } from '../modules/notifications/notification.entity.js';
import { Report } from '../modules/reports/report.entity.js';
import {
  UserRole,
  AssetType,
  ScanType,
  ScanStatus,
  SeverityLevel,
  ScanFrequency,
  AIAnalysisStatus,
  RiskLevel,
  NotificationType,
} from '../common/enums/index.js';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Organization,
    OrganizationMember,
    Asset,
    Scan,
    Vulnerability,
    ScanFinding,
    AIAnalysis,
    ScanSchedule,
    Notification,
    Report,
  ],
  synchronize: false,
});

async function seed(): Promise<void> {
  console.log('🌱 Starting VaultScan seed...');
  await dataSource.initialize();
  console.log('✅ Database connected');

  const userRepo = dataSource.getRepository(User);
  const orgRepo = dataSource.getRepository(Organization);
  const memberRepo = dataSource.getRepository(OrganizationMember);
  const assetRepo = dataSource.getRepository(Asset);
  const scanRepo = dataSource.getRepository(Scan);
  const vulnRepo = dataSource.getRepository(Vulnerability);
  const findingRepo = dataSource.getRepository(ScanFinding);
  const aiRepo = dataSource.getRepository(AIAnalysis);
  const scheduleRepo = dataSource.getRepository(ScanSchedule);
  const notifRepo = dataSource.getRepository(Notification);

  // ─── Clean existing seed data ────────────────────
  console.log('🧹 Cleaning existing data...');
  await dataSource.query('DELETE FROM notifications');
  await dataSource.query('DELETE FROM ai_analyses');
  await dataSource.query('DELETE FROM scan_findings');
  await dataSource.query('DELETE FROM reports');
  await dataSource.query('DELETE FROM scan_schedules');
  await dataSource.query('DELETE FROM scans');
  await dataSource.query('DELETE FROM assets');
  await dataSource.query('DELETE FROM organization_members');
  await dataSource.query('DELETE FROM organizations');
  await dataSource.query('DELETE FROM vulnerabilities');
  // Delete seed users only
  const seedEmails = ['admin@demo.com', 'editor@demo.com', 'viewer@demo.com'];
  for (const email of seedEmails) {
    await dataSource.query('DELETE FROM users WHERE email = $1', [email]);
  }

  // ─── Organization ────────────────────────────────
  console.log('🏢 Creating organization...');
  const org = orgRepo.create({ name: 'Demo Corp' });
  const savedOrg = await orgRepo.save(org);

  // ─── Users ───────────────────────────────────────
  console.log('👤 Creating users...');
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const editorHash = await bcrypt.hash('Editor123!', 12);
  const viewerHash = await bcrypt.hash('Viewer123!', 12);

  const adminUser = await userRepo.save(
    userRepo.create({ name: 'Admin User', email: 'admin@demo.com', passwordHash: adminHash }),
  );
  const editorUser = await userRepo.save(
    userRepo.create({ name: 'Ahmed Editor', email: 'editor@demo.com', passwordHash: editorHash }),
  );
  const viewerUser = await userRepo.save(
    userRepo.create({ name: 'Sara Viewer', email: 'viewer@demo.com', passwordHash: viewerHash }),
  );

  // ─── Org Members ─────────────────────────────────
  console.log('👥 Adding members to org...');
  await memberRepo.save([
    memberRepo.create({ userId: adminUser.id, orgId: savedOrg.id, role: UserRole.ADMIN }),
    memberRepo.create({ userId: editorUser.id, orgId: savedOrg.id, role: UserRole.EDITOR }),
    memberRepo.create({ userId: viewerUser.id, orgId: savedOrg.id, role: UserRole.VIEWER }),
  ]);

  // ─── Assets ──────────────────────────────────────
  console.log('🖥️  Creating assets...');
  const [assetWebsite, assetApi, assetApp, assetNetwork] = await assetRepo.save([
    assetRepo.create({
      name: 'Main Website',
      type: AssetType.DOMAIN,
      value: 'example.com',
      orgId: savedOrg.id,
      createdBy: adminUser.id,
    }),
    assetRepo.create({
      name: 'API Server',
      type: AssetType.IP,
      value: '192.168.1.100',
      orgId: savedOrg.id,
      createdBy: adminUser.id,
    }),
    assetRepo.create({
      name: 'Web Application',
      type: AssetType.URL,
      value: 'https://app.example.com',
      orgId: savedOrg.id,
      createdBy: editorUser.id,
    }),
    assetRepo.create({
      name: 'Internal Network',
      type: AssetType.CIDR,
      value: '10.0.0.0/24',
      orgId: savedOrg.id,
      createdBy: adminUser.id,
    }),
  ]);

  // ─── Vulnerabilities ─────────────────────────────
  console.log('🛡️  Creating vulnerability catalog...');
  const vulns = await vulnRepo.save([
    vulnRepo.create({
      name: 'SQL Injection',
      severity: SeverityLevel.CRITICAL,
      category: 'INJECTION',
      description: 'SQL injection allows attackers to manipulate database queries, potentially accessing, modifying, or deleting data. This can lead to complete database compromise.',
      remediation: 'Use parameterized queries and prepared statements. Implement input validation and use ORM frameworks that handle query escaping automatically.',
    }),
    vulnRepo.create({
      name: 'Cross-Site Scripting (XSS)',
      severity: SeverityLevel.HIGH,
      category: 'XSS',
      description: 'XSS allows attackers to inject malicious scripts into web pages viewed by other users, enabling session hijacking, defacement, and phishing.',
      remediation: 'Sanitize all user inputs and use Content Security Policy. Encode output appropriately for the context (HTML, JavaScript, URL, CSS).',
    }),
    vulnRepo.create({
      name: 'SSL Certificate Expired',
      severity: SeverityLevel.CRITICAL,
      category: 'SSL',
      description: 'The SSL certificate has expired, leaving communications unencrypted and users vulnerable to man-in-the-middle attacks.',
      remediation: 'Renew the SSL certificate immediately and set up auto-renewal to prevent future expirations.',
    }),
    vulnRepo.create({
      name: 'Weak TLS Version',
      severity: SeverityLevel.HIGH,
      category: 'SSL',
      description: 'Server supports TLS 1.0/1.1 which are deprecated and contain known cryptographic weaknesses.',
      remediation: 'Disable TLS 1.0 and 1.1, enforce TLS 1.2 minimum. Configure strong cipher suites.',
    }),
    vulnRepo.create({
      name: 'Open RDP Port',
      severity: SeverityLevel.HIGH,
      category: 'NETWORK',
      description: 'Port 3389 (RDP) is publicly accessible, making the server vulnerable to brute force attacks and known RDP exploits.',
      remediation: 'Restrict RDP access using firewall rules or VPN. Enable Network Level Authentication and use strong passwords.',
    }),
    vulnRepo.create({
      name: 'Open Telnet Port',
      severity: SeverityLevel.HIGH,
      category: 'NETWORK',
      description: 'Telnet transmits data in plaintext including credentials, making all communications susceptible to eavesdropping.',
      remediation: 'Disable Telnet, use SSH instead for remote management.',
    }),
    vulnRepo.create({
      name: 'Missing CSP Header',
      severity: SeverityLevel.MEDIUM,
      category: 'HEADERS',
      description: 'Content Security Policy header not present. Without CSP, the application is more vulnerable to XSS and data injection attacks.',
      remediation: 'Add Content-Security-Policy response header with appropriate directives to restrict resource loading.',
    }),
    vulnRepo.create({
      name: 'Missing HSTS Header',
      severity: SeverityLevel.MEDIUM,
      category: 'HEADERS',
      description: 'HTTP Strict Transport Security not configured. Users could be redirected to HTTP versions of the site.',
      remediation: 'Add Strict-Transport-Security header with max-age of at least one year and includeSubDomains directive.',
    }),
    vulnRepo.create({
      name: 'Server Version Disclosure',
      severity: SeverityLevel.MEDIUM,
      category: 'DISCLOSURE',
      description: 'Server header reveals software version, giving attackers information to find known vulnerabilities for that version.',
      remediation: 'Configure server to suppress version information in response headers.',
    }),
    vulnRepo.create({
      name: 'Exposed Admin Panel',
      severity: SeverityLevel.MEDIUM,
      category: 'EXPOSURE',
      description: 'Admin interface accessible without authentication or IP restrictions, potentially allowing unauthorized administrative access.',
      remediation: 'Restrict admin panel access by IP or add multi-factor authentication.',
    }),
    vulnRepo.create({
      name: 'Open MySQL Port',
      severity: SeverityLevel.CRITICAL,
      category: 'NETWORK',
      description: 'Database port 3306 is publicly accessible, allowing direct connection attempts to the database server.',
      remediation: 'Firewall database ports, allow only app server access. Never expose database ports to the public internet.',
    }),
    vulnRepo.create({
      name: 'Missing X-Frame-Options',
      severity: SeverityLevel.LOW,
      category: 'HEADERS',
      description: 'Page can be embedded in iframes posing a clickjacking risk where users could be tricked into clicking hidden elements.',
      remediation: 'Add X-Frame-Options: DENY or SAMEORIGIN header to prevent iframe embedding.',
    }),
    vulnRepo.create({
      name: 'Self-Signed Certificate',
      severity: SeverityLevel.HIGH,
      category: 'SSL',
      description: 'Server uses a self-signed certificate which browsers do not trust, warning users and undermining security.',
      remediation: 'Replace with a certificate from a trusted Certificate Authority such as Let\'s Encrypt.',
    }),
    vulnRepo.create({
      name: 'Reflected XSS',
      severity: SeverityLevel.HIGH,
      category: 'XSS',
      description: 'User input is reflected in the response without proper encoding, allowing script injection through crafted URLs.',
      remediation: 'Encode all reflected user input using context-appropriate encoding functions.',
    }),
    vulnRepo.create({
      name: 'Open FTP Port',
      severity: SeverityLevel.MEDIUM,
      category: 'NETWORK',
      description: 'FTP transmits credentials in plaintext and lacks encryption for data transfer.',
      remediation: 'Disable FTP, use SFTP or FTPS instead for file transfer.',
    }),
  ]);

  // Map vulns by name for easy lookup
  const vulnMap = new Map(vulns.map((v) => [v.name, v]));

  // ─── Scans ───────────────────────────────────────
  console.log('🔍 Creating scans...');
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const scan1 = await scanRepo.save(
    scanRepo.create({
      type: ScanType.DEEP,
      status: ScanStatus.COMPLETED,
      assetId: assetWebsite.id,
      orgId: savedOrg.id,
      initiatedBy: adminUser.id,
      startedAt: twoDaysAgo,
      completedAt: new Date(twoDaysAgo.getTime() + 15 * 60 * 1000),
    }),
  );

  const scan2 = await scanRepo.save(
    scanRepo.create({
      type: ScanType.QUICK,
      status: ScanStatus.COMPLETED,
      assetId: assetApi.id,
      orgId: savedOrg.id,
      initiatedBy: adminUser.id,
      startedAt: oneDayAgo,
      completedAt: new Date(oneDayAgo.getTime() + 2 * 60 * 1000),
    }),
  );

  const scan3 = await scanRepo.save(
    scanRepo.create({
      type: ScanType.QUICK,
      status: ScanStatus.COMPLETED,
      assetId: assetApp.id,
      orgId: savedOrg.id,
      initiatedBy: editorUser.id,
      startedAt: threeHoursAgo,
      completedAt: new Date(threeHoursAgo.getTime() + 90 * 1000),
    }),
  );

  // ─── Scan Findings ───────────────────────────────
  console.log('🐛 Creating scan findings...');
  // Scan 1 findings: SQLi, XSS, Missing CSP, Missing HSTS, X-Frame-Options
  await findingRepo.save([
    findingRepo.create({
      scanId: scan1.id,
      vulnId: vulnMap.get('SQL Injection')!.id,
      location: 'https://example.com/login',
      evidence: 'Parameter "email" vulnerable to SQL injection: \' OR 1=1 --\nServer returned 200 with full user list.',
    }),
    findingRepo.create({
      scanId: scan1.id,
      vulnId: vulnMap.get('Cross-Site Scripting (XSS)')!.id,
      location: 'https://example.com/search?q=',
      evidence: 'Reflected XSS payload: <script>alert(1)</script>\nPayload was rendered unescaped in search results.',
    }),
    findingRepo.create({
      scanId: scan1.id,
      vulnId: vulnMap.get('Missing CSP Header')!.id,
      location: 'https://example.com',
      evidence: 'No Content-Security-Policy header found in response headers.',
    }),
    findingRepo.create({
      scanId: scan1.id,
      vulnId: vulnMap.get('Missing HSTS Header')!.id,
      location: 'https://example.com',
      evidence: 'Strict-Transport-Security header not present in response.',
    }),
    findingRepo.create({
      scanId: scan1.id,
      vulnId: vulnMap.get('Missing X-Frame-Options')!.id,
      location: 'https://example.com',
      evidence: 'X-Frame-Options header not set. Page can be embedded in iframes.',
    }),
  ]);

  // Scan 2 findings: Open RDP, Open MySQL, Open Telnet
  await findingRepo.save([
    findingRepo.create({
      scanId: scan2.id,
      vulnId: vulnMap.get('Open RDP Port')!.id,
      location: '192.168.1.100:3389',
      evidence: 'Port 3389 (RDP) is open and accepting connections.\nBanner: Microsoft Terminal Services',
    }),
    findingRepo.create({
      scanId: scan2.id,
      vulnId: vulnMap.get('Open MySQL Port')!.id,
      location: '192.168.1.100:3306',
      evidence: 'Port 3306 (MySQL) is open.\nBanner: 8.0.32-MySQL Community Server',
    }),
    findingRepo.create({
      scanId: scan2.id,
      vulnId: vulnMap.get('Open Telnet Port')!.id,
      location: '192.168.1.100:23',
      evidence: 'Port 23 (Telnet) is open and accepting connections.',
    }),
  ]);

  // Scan 3 findings: Server Version Disclosure, Missing CSP
  await findingRepo.save([
    findingRepo.create({
      scanId: scan3.id,
      vulnId: vulnMap.get('Server Version Disclosure')!.id,
      location: 'https://app.example.com',
      evidence: 'Server header reveals: nginx/1.18.0 (Ubuntu)',
    }),
    findingRepo.create({
      scanId: scan3.id,
      vulnId: vulnMap.get('Missing CSP Header')!.id,
      location: 'https://app.example.com',
      evidence: 'Content-Security-Policy header not found.',
    }),
  ]);

  // ─── AI Analyses ─────────────────────────────────
  console.log('🤖 Creating AI analyses...');
  const ai1 = aiRepo.create({
    scanId: scan1.id,
    status: AIAnalysisStatus.COMPLETED,
    geminiModel: 'gemini-2.0-flash-exp',
    riskScore: 85,
    riskLevel: RiskLevel.CRITICAL,
    analysisText:
      'This assessment reveals critical security vulnerabilities that require immediate attention. The presence of SQL injection and XSS vulnerabilities poses severe risk of data breach and account compromise. The SQL injection vulnerability in the login endpoint could allow full database access, while the XSS vulnerability enables session hijacking and phishing attacks. Immediate remediation is strongly advised.',
    recommendations: [
      { priority: 1, action: 'Fix SQL Injection in login endpoint', rationale: 'Critical risk of full database compromise', effort: 'MEDIUM' },
      { priority: 2, action: 'Implement Content Security Policy', rationale: 'Prevents XSS exploitation', effort: 'LOW' },
      { priority: 3, action: 'Enable HSTS', rationale: 'Forces HTTPS and prevents downgrade attacks', effort: 'LOW' },
    ],
    keyFindings: [
      { title: 'SQL Injection', impact: 'Complete database access', likelihood: 'Easy to exploit' },
      { title: 'XSS', impact: 'Session hijacking, phishing', likelihood: 'Moderate' },
    ],
    attackVectors: ['Database compromise via SQLi', 'User session theft via XSS', 'Credential theft'] as unknown as Record<string, unknown>[],
    technicalDetails:
      'The SQL injection was found in the login form\'s email parameter. The application constructs SQL queries using string concatenation rather than parameterized queries. Testing with payload \' OR 1=1 -- returned the full user list, confirming the vulnerability. The XSS vulnerability exists in the search functionality where user input is reflected without encoding.',
    complianceNotes: 'OWASP Top 10: A01 (Injection), A03 (XSS). PCI DSS: Requirement 6.5.1 (Injection flaws). SOC2: CC6.1 (Logical and Physical Access Controls).',
    promptTokens: 1250,
    completionTokens: 890,
  });
  await aiRepo.save(ai1);

  const ai2 = aiRepo.create({
    scanId: scan2.id,
    status: AIAnalysisStatus.COMPLETED,
    geminiModel: 'gemini-2.0-flash-exp',
    riskScore: 72,
    riskLevel: RiskLevel.HIGH,
    analysisText:
      'The API server has multiple exposed network services that significantly increase the attack surface. The open MySQL port is particularly concerning as it allows direct database connection attempts from the internet. Combined with RDP and Telnet exposure, this server requires immediate network hardening.',
    recommendations: [
      { priority: 1, action: 'Close MySQL port to public access', rationale: 'Direct database exposure is critical risk', effort: 'LOW' },
      { priority: 2, action: 'Restrict RDP access via VPN', rationale: 'Prevents brute force attacks on remote desktop', effort: 'MEDIUM' },
      { priority: 3, action: 'Disable Telnet service', rationale: 'Telnet transmits credentials in plaintext', effort: 'LOW' },
    ],
    keyFindings: [
      { title: 'Open MySQL Port', impact: 'Direct database access from internet', likelihood: 'High' },
      { title: 'Open RDP Port', impact: 'Remote server compromise', likelihood: 'Moderate' },
    ],
    attackVectors: ['Direct database connection', 'RDP brute force', 'Telnet credential sniffing'] as unknown as Record<string, unknown>[],
    technicalDetails:
      'Port scan revealed three high-risk services: MySQL (3306), RDP (3389), and Telnet (23) all accepting external connections. MySQL responded with version banner indicating Community Server 8.0.32.',
    complianceNotes: 'PCI DSS: Requirement 1.3 (Firewall configuration). CIS Controls: 9.2 (Ensure only necessary ports are open).',
    promptTokens: 980,
    completionTokens: 720,
  });
  await aiRepo.save(ai2);

  const ai3 = aiRepo.create({
    scanId: scan3.id,
    status: AIAnalysisStatus.COMPLETED,
    geminiModel: 'gemini-2.0-flash-exp',
    riskScore: 35,
    riskLevel: RiskLevel.MEDIUM,
    analysisText:
      'The web application has moderate information disclosure and missing security headers. While not immediately exploitable, these issues provide attackers with useful reconnaissance data and leave the application without important browser security protections.',
    recommendations: [
      { priority: 1, action: 'Remove server version from response headers', rationale: 'Reduces information available to attackers', effort: 'LOW' },
      { priority: 2, action: 'Add Content-Security-Policy header', rationale: 'Prevents XSS and other injection attacks', effort: 'LOW' },
    ],
    keyFindings: [
      { title: 'Server Version Disclosure', impact: 'Information leakage', likelihood: 'Low' },
    ],
    attackVectors: ['Version-specific exploit research', 'XSS via missing CSP'] as unknown as Record<string, unknown>[],
    technicalDetails:
      'Server responds with "nginx/1.18.0 (Ubuntu)" in the Server header. No Content-Security-Policy header is set, allowing unrestricted resource loading.',
    complianceNotes: 'OWASP: A05 (Security Misconfiguration). CIS Controls: 18.3 (Remove unnecessary headers).',
    promptTokens: 650,
    completionTokens: 480,
  });
  await aiRepo.save(ai3);

  // ─── Scan Schedule ───────────────────────────────
  console.log('📅 Creating scan schedule...');
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  nextSunday.setHours(2, 0, 0, 0);

  await scheduleRepo.save(
    scheduleRepo.create({
      scanType: ScanType.DEEP,
      frequency: ScanFrequency.WEEKLY,
      dayOfWeek: 0,
      timeOfDay: '02:00',
      nextRunAt: nextSunday,
      isActive: true,
      assetId: assetWebsite.id,
      orgId: savedOrg.id,
      createdBy: adminUser.id,
    }),
  );

  // ─── Notifications ───────────────────────────────
  console.log('🔔 Creating notifications...');
  await notifRepo.save([
    notifRepo.create({
      userId: adminUser.id,
      type: NotificationType.SCAN_COMPLETE,
      message: 'Scan on Main Website completed — 5 vulnerabilities found',
      isRead: false,
      metadata: { scanId: scan1.id, findingsCount: 5 },
    }),
    notifRepo.create({
      userId: adminUser.id,
      type: NotificationType.AI_ANALYSIS_READY,
      message: 'AI analysis ready — Risk score: 85/100',
      isRead: false,
      metadata: { scanId: scan1.id, riskScore: 85 },
    }),
    notifRepo.create({
      userId: adminUser.id,
      type: NotificationType.SCAN_COMPLETE,
      message: 'Scan on API Server completed — 3 vulnerabilities found',
      isRead: true,
      metadata: { scanId: scan2.id, findingsCount: 3 },
    }),
  ]);

  console.log('');
  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📋 Demo Accounts:');
  console.log('   Admin  → admin@demo.com  / Admin123!');
  console.log('   Editor → editor@demo.com / Editor123!');
  console.log('   Viewer → viewer@demo.com / Viewer123!');
  console.log('');

  await dataSource.destroy();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
