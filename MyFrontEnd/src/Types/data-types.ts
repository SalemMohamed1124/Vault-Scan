import z from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "none"]);

export const DomainSchema = z.object({
  id: z.string(),
  value: z.string(),
  ip: z.string(),
  status: z.enum(["active", "inactive"]),
  ssl: z.enum(["valid", "expired", "none"]),
  lastScan: z.string().optional(),
  vulnerabilities: z.number().optional(),
  severity: SeveritySchema,
  registrar: z.string().optional(),
  nameServers: z.array(z.string()).optional(),
  expiryDate: z.string().optional(),
  createdDate: z.string().optional(),
});
export const DomainsSchema = z.array(DomainSchema);

export const IpSchema = z.object({
  id: z.string(),
  value: z.string(),
  hostname: z.string(),
  location: z.string().optional(),
  openPorts: z.number().optional(),
  services: z.number().optional(),
  lastScan: z.string().optional(),
  vulnerabilities: z.number().optional(),
  severity: SeveritySchema,
});
export const IpsSchema = z.array(IpSchema);

export const PortSchema = z.object({
  id: z.string(),
  value: z.number(),
  protocol: z.enum(["TCP", "UDP"]),
  service: z.string(),
  ip: z.string(),
  status: z.enum(["open", "filtered", "closed"]),
  banner: z.string().optional(),
  lastScan: z.string().optional(),
  vulnerabilities: z.number().optional(),
  severity: SeveritySchema,
});
export const PortsSchema = z.array(PortSchema);

export const RemediationPlanSchema = z.object({
  overview: z.string(),
  shortTerm: z.array(z.string()),
  longTerm: z.array(z.string()),
  verification: z.array(z.string()),
});

export const VulnerabilitySchema = z.object({
  id: z.string(),
  cveId: z.string(),
  title: z.string(),
  asset: z.union([IpSchema, DomainSchema]),
  category: z.string(),
  severity: SeveritySchema,
  cvss: z.number(),
  discovered: z.string(),
  status: z.enum(["open", "fixed"]),
  fixedDate: z.string().optional(),
  fixedBy: z.string().optional(),
  remediationPlan: RemediationPlanSchema.optional(),
});
export const VulnerabilitiesSchema = z.array(VulnerabilitySchema);

export const AssetTypeSchema = z.enum(["domain", "ip"]);
export const AssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: AssetTypeSchema,
  value: z.string(),
  tags: z.array(z.string()),
  addedDate: z.string(),
  lastScan: z.string().nullable().optional(),
});
export const AssetsSchema = z.array(AssetSchema);

export const FrequencyModeSchema = z.enum(["once", "repeat"]).nullable();
export const RepeatEverySchema = z.number().nullable();
export const RepeatUnitSchema = z.enum(["day", "week", "month"]).nullable();

export const ScanTypeSchema = z.enum(["full", "vulnerability", "port", "quick"]);
export const ScanStatusSchema = z.enum(["active", "paused", "running", "manual"]);
export const LastExecutionStatusSchema = z.enum(["completed", "failed", "canceled"]);

export const LastScanSchema = z.object({
  id: z.string(),
  status: LastExecutionStatusSchema,
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  duration: z.string().optional(),
  triggeredByUser: z.boolean(),
});

export const ScheduleSchema = z.object({
  id: z.string(),
  asset: AssetSchema,
  scanType: ScanTypeSchema,
  frequency: z
    .object({
      mode: FrequencyModeSchema,
      repeatEvery: RepeatEverySchema,
      repeatUnit: RepeatUnitSchema,
    })
    .nullable(),
  firstStartTime: z.string().nullable().optional(),
  nexRunTime: z.string().nullable().optional(),
  status: ScanStatusSchema,
  lastScan: LastScanSchema.nullable(),
});
export const SchedulesSchema = z.array(ScheduleSchema);

export const MemberRoleSchema = z.enum(["editor", "admin", "viewer"]);
export const MemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: MemberRoleSchema,
  joinedDate: z.string(),
  avatar: z.string().optional(),
});
export const MembersSchema = z.array(MemberSchema);

export const InvitationStatusSchema = z.enum(["pending", "accepted", "expired", "revoked"]);
export const InvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: MemberRoleSchema,
  status: InvitationStatusSchema,
  sentBy: z.string(),
  sentDate: z.string(),
  expiresAccepted: z.string().nullable(),
});
export const InvitationsSchema = z.array(InvitationSchema);

export const ScanDetailsSchema = z.object({
  assetInformation: AssetSchema,
  vulnerabilities: z.array(VulnerabilitySchema),
  ports: z.array(PortSchema).optional(),
});

export const ScanSchema = z.object({
  id: z.string(),
  asset: AssetSchema,
  scanType: ScanTypeSchema,
  status: z.enum(["completed", "failed", "canceled", "running"]),
  startTime: z.string(),
  endTime: z.string(),
  duration: z.string(),
  vulnerabilitiesFound: z.number(),
  severity: SeveritySchema,
  triggerType: z.enum(["scheduled", "manual"]),
  fullDetails: ScanDetailsSchema,
});
export const ScansSchema = z.array(ScanSchema);

export const notifcationShcema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.enum(["success", "error", "warning", "info"]),
  read: z.boolean(),
  createdAt: z.date(),
});

export const NotificationsSchema = z.array(notifcationShcema);

export type Severity = z.infer<typeof SeveritySchema>;
export type Domain = z.infer<typeof DomainSchema>;
export type Ip = z.infer<typeof IpSchema>;
export type Port = z.infer<typeof PortSchema>;
export type RemediationPlan = z.infer<typeof RemediationPlanSchema>;
export type Vulnerability = z.infer<typeof VulnerabilitySchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type RepeatUnit = z.infer<typeof RepeatUnitSchema>;
export type scanType = z.infer<typeof ScanTypeSchema>;
export type scanStatus = z.infer<typeof ScanStatusSchema>;
export type LastExecutionStatus = z.infer<typeof LastExecutionStatusSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type ScanDetails = z.infer<typeof ScanDetailsSchema>;
export type Scan = z.infer<typeof ScanSchema>;
export type Notification = z.infer<typeof notifcationShcema>;
