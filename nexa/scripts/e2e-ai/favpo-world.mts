/* eslint-disable @typescript-eslint/no-explicit-any -- the suites pass their own transaction double */
/**
 * The evaluation e2e suites were written against the real data as it stood on 15 Nov 2026: the four closed Favpo rounds
 * (Sep and Oct), the two template rounds and nothing else. On 17 Nov the Favpo rounds were hidden (deletedAt, with a backup
 * file) and our own rounds were opened, so those suites could no longer find their data.
 *
 * Call this first thing inside a rollback transaction: it brings the hidden Favpo rounds and form back and hides every other
 * round, so the suite sees the same world it was written for. Nothing outlives the transaction. If the hidden rows are ever
 * deleted for good, these suites need fixtures of their own.
 *
 * @param tx the interactive transaction client the suite is running in
 */
export async function restoreFavpoWorld(tx: any) {
  await tx.appraisalForm.updateMany({ where: { name: { contains: "Favpo" } }, data: { deletedAt: null } });
  // Only the four closed rounds and the two templates: a test draft someone deleted by hand also has "Favpo" in its name and must stay deleted.
  await tx.appraisalRound.updateMany({ where: { name: { contains: "Favpo" }, OR: [{ isTemplate: true }, { status: "CLOSED" }] }, data: { deletedAt: null } });
  await tx.appraisalRound.updateMany({ where: { NOT: { name: { contains: "Favpo" } }, deletedAt: null }, data: { deletedAt: new Date() } });
}
