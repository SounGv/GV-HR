/**
 * Who may see an evaluation result (blended score, band, breakdown) of a participant.
 * HR and the person's manager see it as soon as it exists; the reviewee only after HR
 * finalized it; an invited PEER/UPWARD rater never does. Pure, so a script can check it.
 */
export function canSeeParticipantResult(v: {
  hrLevel: boolean;
  managesTarget: boolean;
  own: boolean;
  finalized: boolean;
}): boolean {
  return v.hrLevel || v.managesTarget || (v.own && v.finalized);
}
