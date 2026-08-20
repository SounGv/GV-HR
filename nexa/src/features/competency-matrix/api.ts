import { api, type Envelope } from "@/lib/api/client";
import type { CompetencyRequirementRow, EmployeeGapRow, LevelItem } from "./types";

export function fetchPositionRequirements(positionId: string) {
  return api.get<Envelope<CompetencyRequirementRow[]>>(`/api/positions/${positionId}/competency-requirements`);
}

export function setPositionRequirements(positionId: string, items: LevelItem[]) {
  return api.put<Envelope<CompetencyRequirementRow[]>>(`/api/positions/${positionId}/competency-requirements`, {
    items,
  });
}

export function fetchEmployeeCompetencyGap(employeeId: string) {
  return api.get<Envelope<EmployeeGapRow[]>>(`/api/employees/${employeeId}/competency-levels`);
}

export function setEmployeeCompetencyLevels(employeeId: string, items: LevelItem[]) {
  return api.put<Envelope<EmployeeGapRow[]>>(`/api/employees/${employeeId}/competency-levels`, { items });
}
