export interface SessionRow {
  id: string;
  createdIp: string | null;
  userAgent: string | null;
  createdAt: string;
  isCurrent: boolean;
}
