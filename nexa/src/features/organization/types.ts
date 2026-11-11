export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  employeeCount: number;
}

/** One active employee as the org chart's people view needs it (GET /api/org/people). */
export interface OrgPersonRow {
  id: string;
  /** displayName(): "first last (nickname)". */
  name: string;
  nickname: string | null;
  departmentId: string | null;
  managerId: string | null;
  positionTitle: string | null;
}

export interface DepartmentNode extends DepartmentRow {
  children: DepartmentNode[];
}

export interface PositionRow {
  id: string;
  title: string;
  code: string;
  level: number;
  employeeCount: number;
  department: { id: string; name: string } | null;
}

export interface DepartmentFormValues {
  name: string;
  code: string;
  parentId: string | null;
}

export interface PositionFormValues {
  title: string;
  code: string;
  level: string;
  departmentId: string | null;
}
