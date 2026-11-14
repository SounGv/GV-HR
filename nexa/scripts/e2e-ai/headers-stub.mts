/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next and the model SDK */
// Stand-in for next/headers: the signed-in cookie is whatever the test put in globalThis.__token.
export async function cookies() {
  const token = (globalThis as any).__token as string | undefined;
  return {
    get: (name: string) => (name === "nexa_at" && token ? { name, value: token } : undefined),
    getAll: () => [],
    set: () => {},
    delete: () => {},
    has: () => false,
  };
}
export async function headers() {
  return new Headers();
}
