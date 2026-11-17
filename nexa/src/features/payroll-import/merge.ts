export interface AdjustmentLine {
  label: string;
  amount: number;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * What a payslip's extra lines become when a file brings its own: the lines HR already keyed by hand stay, the lines
 * of the file are added, and a line the file also has (same label) is taken from the file, so importing a corrected
 * file again changes the amounts instead of doubling them. The import used to replace everything the payslip had.
 */
export function mergeAdjustmentLines(existing: readonly AdjustmentLine[] | null | undefined, fromFile: readonly AdjustmentLine[]): AdjustmentLine[] {
  const kept = (existing ?? []).filter((e) => !fromFile.some((f) => same(f.label, e.label)));
  return [...kept, ...fromFile];
}
