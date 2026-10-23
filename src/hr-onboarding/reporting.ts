import { addDays } from "./calendar";
import { Store } from "./store";
import { OnboardingCase, Task } from "./types";

// R10: daily exceptions digest and the section 1 metrics, both computed from stored state.

export function isDayOneRisk(c: OnboardingCase, tasks: Task[], today: string): boolean {
  if (c.state === "CLOSED" || c.missingFields.length > 0) return false;
  const start = c.hire.startDate;
  if (!start) return false;
  const preStart = tasks.filter((t) => t.caseId === c.id && t.dueDate <= start);
  return today >= addDays(start, -1) && preStart.some((t) => t.status !== "DONE");
}

export interface Digest {
  today: string;
  openFlags: { flagId: string; type: string; caseId: string | null; owner: string; dueAt: string }[];
  overdueTasks: { taskId: string; caseId: string; key: string; owner: string; dueDate: string }[];
  dayOneRisk: string[];
  blockedCases: string[];
}

export function digest(store: Store, today: string): Digest {
  const cases = Object.values(store.state.cases);
  const tasks = Object.values(store.state.tasks);
  const openFlags = Object.values(store.state.flags)
    .filter((f) => f.status === "OPEN")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((f) => ({ flagId: f.id, type: f.type, caseId: f.caseId, owner: f.owner, dueAt: f.dueAt }));
  const overdueTasks = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate < today && store.state.cases[t.caseId]?.state !== "CLOSED")
    .map((t) => ({ taskId: t.id, caseId: t.caseId, key: t.key, owner: t.owner, dueDate: t.dueDate }));
  return {
    today,
    openFlags,
    overdueTasks,
    dayOneRisk: cases.filter((c) => isDayOneRisk(c, tasks, today)).map((c) => c.id),
    blockedCases: cases.filter((c) => c.state === "BLOCKED").map((c) => c.id),
  };
}

export interface Metrics {
  casesTotal: number;
  casesClosed: number;
  humanTouchesPerCase: number;
  automatedTaskShare: number;
  flagsRaised: number;
  flagsDecided: number;
  falseFlagRate: number | null;
  i9Breaches: number;
  flagsByType: Record<string, number>;
}

export function metrics(store: Store): Metrics {
  const cases = Object.values(store.state.cases);
  const tasks = Object.values(store.state.tasks);
  const flags = Object.values(store.state.flags);

  // A human touch is a decision or an I-9 status entry. Task completions that follow a decision are not counted again.
  const humanActions = store.state.audit.filter(
    (e) => e.actor.startsWith("human:") && (e.action === "flag.decided" || e.action === "i9.recorded"),
  ).length;
  const agentTasks = tasks.filter((t) => t.completedBy === "agent").length;

  const decided = flags.filter((f) => f.status === "DECIDED");
  const dismissed = decided.filter((f) => f.decision?.outcome === "dismissed").length;

  const flagsByType: Record<string, number> = {};
  for (const f of flags) flagsByType[f.type] = (flagsByType[f.type] ?? 0) + 1;

  return {
    casesTotal: cases.length,
    casesClosed: cases.filter((c) => c.state === "CLOSED").length,
    humanTouchesPerCase: cases.length === 0 ? 0 : humanActions / cases.length,
    automatedTaskShare: tasks.length === 0 ? 0 : agentTasks / tasks.length,
    flagsRaised: flags.length,
    flagsDecided: decided.length,
    falseFlagRate: decided.length === 0 ? null : dismissed / decided.length,
    i9Breaches: flags.filter((f) => f.type === "I9_LATE").length,
    flagsByType,
  };
}
