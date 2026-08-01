/**
 * Integration Hub — Adapter Pattern.
 *
 * Every external system (TR Cloud, SAP, Microsoft, Google, LINE, …) is reached
 * only through the `IntegrationAdapter` contract. Business logic depends on the
 * interface, never on a concrete vendor — so you can swap the ERP in the future
 * without touching any module code.
 */

export type IntegrationCategory = "erp" | "productivity" | "messaging" | "storage" | "api";
export type IntegrationStatus = "connected" | "available" | "coming_soon";

export interface SyncResult {
  ok: boolean;
  message: string;
  count?: number;
}

/** The contract every adapter must implement. */
export interface IntegrationAdapter {
  readonly id: string;
  readonly name: string;
  readonly category: IntegrationCategory;
  /** Verify credentials / reachability without mutating anything. */
  testConnection(config: Record<string, string>): Promise<SyncResult>;
  /** Optional capabilities — presence signals what the adapter supports. */
  syncEmployees?(): Promise<SyncResult>;
  pushAttendance?(period: string): Promise<SyncResult>;
  pushPayroll?(period: string): Promise<SyncResult>;
  sendMessage?(to: string, body: string): Promise<SyncResult>;
}

/** UI/registry descriptor (metadata) for an integration. */
export interface IntegrationDescriptor {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** lucide icon name resolved in the UI */
  icon: string;
  status: IntegrationStatus;
  capabilities: string[];
  /** Config fields the connect dialog would ask for. */
  configFields: { key: string; label: string; secret?: boolean }[];
}

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  erp: "ERP / HRIS",
  productivity: "Productivity",
  messaging: "Messaging",
  storage: "Storage",
  api: "API & Automation",
};

/** The registry of adapters exposed in the Integration Hub. */
export const INTEGRATIONS: IntegrationDescriptor[] = [
  {
    id: "tr-cloud",
    name: "TR Cloud ERP",
    category: "erp",
    description: "ซิงก์พนักงาน เงินเดือน และบัญชีกับ TR Cloud ผ่าน Adapter มาตรฐาน",
    icon: "Cloud",
    status: "available",
    capabilities: ["ซิงก์พนักงาน", "ส่งเงินเดือน", "บัญชี GL"],
    configFields: [
      { key: "baseUrl", label: "API Base URL" },
      { key: "apiKey", label: "API Key", secret: true },
    ],
  },
  {
    id: "sap",
    name: "SAP SuccessFactors",
    category: "erp",
    description: "เชื่อมข้อมูลบุคลากรและโครงสร้างองค์กรกับ SAP",
    icon: "Building2",
    status: "coming_soon",
    capabilities: ["ซิงก์พนักงาน", "โครงสร้างองค์กร"],
    configFields: [
      { key: "tenant", label: "Tenant" },
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client Secret", secret: true },
    ],
  },
  {
    id: "microsoft-365",
    name: "Microsoft 365",
    category: "productivity",
    description: "Azure AD SSO, ปฏิทิน Outlook และแจ้งเตือนผ่าน Teams",
    icon: "LayoutGrid",
    status: "available",
    capabilities: ["SSO", "ปฏิทิน", "Teams แจ้งเตือน"],
    configFields: [
      { key: "tenantId", label: "Directory (tenant) ID" },
      { key: "clientId", label: "Application (client) ID" },
      { key: "clientSecret", label: "Client Secret", secret: true },
    ],
  },
  {
    id: "google-workspace",
    name: "Google Workspace",
    category: "productivity",
    description: "Google SSO, ซิงก์ปฏิทิน และไดเรกทอรีผู้ใช้",
    icon: "Globe",
    status: "available",
    capabilities: ["SSO", "ปฏิทิน", "Directory"],
    configFields: [
      { key: "clientId", label: "OAuth Client ID" },
      { key: "clientSecret", label: "OAuth Client Secret", secret: true },
    ],
  },
  {
    id: "line",
    name: "LINE Official Account",
    category: "messaging",
    description: "ส่งแจ้งเตือนสลิปเงินเดือน อนุมัติลา และประกาศผ่าน LINE",
    icon: "MessageCircle",
    status: "available",
    capabilities: ["แจ้งเตือน", "Push message", "Rich menu"],
    configFields: [
      { key: "channelId", label: "Channel ID" },
      { key: "channelSecret", label: "Channel Secret", secret: true },
      { key: "accessToken", label: "Access Token", secret: true },
    ],
  },
  {
    id: "cloudflare-r2",
    name: "Cloudflare R2",
    category: "storage",
    description: "จัดเก็บเอกสาร สลิป และไฟล์แนบบน object storage",
    icon: "HardDrive",
    status: "available",
    capabilities: ["เอกสาร", "สลิป PDF", "ไฟล์แนบ"],
    configFields: [
      { key: "accountId", label: "Account ID" },
      { key: "accessKeyId", label: "Access Key ID" },
      { key: "secretAccessKey", label: "Secret Access Key", secret: true },
      { key: "bucket", label: "Bucket" },
    ],
  },
  {
    id: "rest-webhook",
    name: "REST API & Webhooks",
    category: "api",
    description: "เปิด REST API (OpenAPI/Swagger) และส่ง Webhook เมื่อมีเหตุการณ์",
    icon: "Webhook",
    status: "available",
    capabilities: ["REST API", "Webhook", "OpenAPI"],
    configFields: [{ key: "webhookUrl", label: "Webhook URL" }],
  },
  {
    id: "graphql",
    name: "GraphQL Gateway",
    category: "api",
    description: "GraphQL endpoint สำหรับดึงข้อมูลแบบยืดหยุ่น (Ready)",
    icon: "Share2",
    status: "coming_soon",
    capabilities: ["GraphQL", "Schema-first"],
    configFields: [],
  },
];
