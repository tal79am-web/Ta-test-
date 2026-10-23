import { TrackSourceRecord, WorkerType } from "./types";

// R3: worker-type consistency gate. Pure function, no side effects.

export const WORKER_TYPES: readonly WorkerType[] = ["employee", "contractor"];

export function isWorkerType(value: unknown): value is WorkerType {
  return typeof value === "string" && (WORKER_TYPES as readonly string[]).includes(value);
}

export type GateResult =
  | { status: "ASSIGNED"; track: WorkerType }
  | { status: "AMBIGUOUS"; reasons: string[]; evidence: { workerId: string; sources: TrackSourceRecord } };

/**
 * Assigns a track only when Workday, the offer and the intake email all give the
 * same valid worker type, and no linked worker record disagrees. Any missing or
 * mismatched value makes the result ambiguous.
 */
export function evaluateTrackGate(workerId: string, sources: TrackSourceRecord): GateResult {
  const reasons: string[] = [];
  const named: [string, unknown][] = [
    ["workday", sources.workday],
    ["offer", sources.offer],
    ["email", sources.email],
  ];

  for (const [name, value] of named) {
    if (value === undefined) reasons.push(`${name} source has no worker type`);
    else if (!isWorkerType(value)) reasons.push(`${name} source has unrecognised worker type "${String(value)}"`);
  }

  const valid = named.map(([, v]) => v).filter(isWorkerType);
  if (valid.length === named.length && new Set(valid).size > 1) {
    reasons.push(`sources disagree: ${named.map(([n, v]) => `${n}=${String(v)}`).join(", ")}`);
  }

  const primary = valid[0];
  for (const record of sources.linked ?? []) {
    if (primary !== undefined && record.workerType !== primary) {
      reasons.push(`linked record ${record.workerId} shows ${record.workerType}, not ${primary}`);
    }
  }

  if (reasons.length === 0 && primary !== undefined) {
    return { status: "ASSIGNED", track: primary };
  }
  return { status: "AMBIGUOUS", reasons, evidence: { workerId, sources } };
}
