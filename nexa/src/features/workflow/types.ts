export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type StepStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RequestScope = "me" | "inbox" | "all";

export interface WorkflowStepDef {
  order: number;
  name: string;
  approverRole: string;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string | null;
  steps: WorkflowStepDef[];
  active: boolean;
}

export interface RequestStep {
  order: number;
  name: string;
  approverRole: string;
  status: StepStatus;
  decidedByName?: string;
  decidedAt?: string;
  note?: string;
}

export interface ApprovalRequest {
  id: string;
  workflowName: string;
  requesterName: string;
  title: string;
  detail: string | null;
  amount: number | null;
  steps: RequestStep[];
  currentStep: number;
  status: RequestStatus;
  createdAt: string;
}

export interface WorkflowFormValues {
  name: string;
  description?: string;
  steps: WorkflowStepDef[];
  active: boolean;
}

export interface RequestFormValues {
  workflowId: string;
  title: string;
  detail?: string;
  amount?: string;
}
