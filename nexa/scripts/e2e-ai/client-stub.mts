/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next and the model SDK */
// Stand-in for lib/ai/client: a scripted "model" so the whole chat route runs without an API key or network.
export const AI_MODEL = "scripted-test-model";
export const isAiConfigured = () => true;

type Resp = { stop_reason: string; content: any[] };
export function getAnthropic() {
  return {
    messages: {
      create: async (params: any) => {
        const g = globalThis as any;
        g.__calls.push(JSON.parse(JSON.stringify(params)));
        const next: Resp | undefined = g.__script.shift();
        if (!next) throw new Error("script ran out: the route asked the model more times than the test expected");
        return next;
      },
    },
  };
}
