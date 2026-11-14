/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next and the model SDK */
// Stand-in for lib/prisma: forwards to the real client, or, while a test sets globalThis.__tx, to that open
// transaction. The test finishes by throwing, so the database rolls everything back and keeps nothing.
import { prisma as real } from "@real/prisma";

async function inOrder(items: PromiseLike<unknown>[]) {
  const out: unknown[] = [];
  for (const i of items) out.push(await i); // one by one, like a batch transaction
  return out;
}

export const prisma: typeof real = new Proxy({} as typeof real, {
  get(_t, prop) {
    const g = globalThis as any;
    const target = g.__tx ?? real;
    if (prop === "$transaction") {
      return async (arg: any, opts?: any) => {
        if (!g.__tx) return (real as any).$transaction(arg, opts);
        return Array.isArray(arg) ? inOrder(arg) : arg(g.__tx);
      };
    }
    const v = (target as any)[prop];
    return typeof v === "function" ? v.bind(target) : v;
  },
});
