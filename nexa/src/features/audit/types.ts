export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: {
    email: string;
    name: string | null;
  } | null;
}
