/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next and the model SDK */
// next/cache needs a running Next request; the tests have none.
export const revalidateTag = () => {};
export const revalidatePath = () => {};
export const unstable_cache = <T extends (...a: any[]) => any>(fn: T) => fn;
