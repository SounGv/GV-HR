/**
 * The frozen copy of the forms a round uses (pure, no imports; checked by
 * `node --experimental-strip-types scripts/check-appraisal-round.mjs`).
 *
 * A round has one default form and people may each be rated with another one, so the
 * snapshot holds every form in use, keyed by form id.
 */

export interface FormSnap {
  id: string;
  name: string;
  version: number;
  ratingMax: number;
  questions: {
    id: string;
    text: string;
    helpText: string | null;
    answerType: "RATING" | "CHOICE" | "MULTI_CHOICE" | "SHORT_TEXT" | "PARAGRAPH";
    options: { value: string; label: string }[] | null;
    weight: number;
    required: boolean;
    visibleTo: string[];
  }[];
}

export interface RoundSnapshot {
  defaultFormId: string;
  forms: Record<string, FormSnap>;
}

/** The form a person is rated with: their own choice, else the round's default. Null when the snapshot has neither. */
export function pickForm(snapshot: RoundSnapshot | null | undefined, participantFormId: string | null): FormSnap | null {
  if (!snapshot || !snapshot.forms) return null;
  return snapshot.forms[participantFormId ?? snapshot.defaultFormId] ?? snapshot.forms[snapshot.defaultFormId] ?? null;
}

/** Every distinct form a round needs: the default plus whatever people were given instead. */
export function formsInUse(defaultFormId: string, participantFormIds: readonly (string | null)[]): string[] {
  return [...new Set([defaultFormId, ...participantFormIds.filter((id): id is string => !!id)])];
}
