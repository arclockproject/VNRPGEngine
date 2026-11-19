// wait(ms): the engine's plain pause (fades, timings). Event scripts use the skippable one instead
// (sceneWait in core/managers/events.ts: ends early while skipping, instant while fast-forwarding).
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
