import { setTimeout as delay } from "node:timers/promises";

function signalOwnedGroup(pid, signal) {
  // Only accept the PID returned by our detached spawn, never a broad name match.
  if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid) {
    throw new Error("Invalid owned smoke process group");
  }
  try { process.kill(-pid, signal); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

export async function waitForSmokeProcessGroupExit(pid, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (signalOwnedGroup(pid, 0)) {
    if (Date.now() >= deadline) return false;
    await delay(Math.min(50, deadline - Date.now()));
  }
  return true;
}

// Failure recovery only: ordinary smoke success must first prove natural exit.
// Wait for the group, not the parent: an exited leader may leave live helpers.
export async function cleanupSmokeProcessGroup(pid, timeoutMs = 3000) {
  const signals = [];
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    if (!signalOwnedGroup(pid, signal)) return { confirmed: true, signals };
    signals.push(signal);
    if (await waitForSmokeProcessGroupExit(pid, timeoutMs)) return { confirmed: true, signals };
  }
  throw new Error(`Owned smoke process group ${pid} did not exit; fixtures retained`);
}
