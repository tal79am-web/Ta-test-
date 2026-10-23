import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { Orchestrator } from "./orchestrator";
import { Store } from "./store";
import { SandboxSystems } from "./sandbox";
import { DirectoryEntry } from "./buddy";
import { IntakeClassifier, IntakeEmail } from "./intake";
import { digest, metrics } from "./reporting";
import { NO_HOLIDAYS } from "./calendar";
import { evaluateTrackGate } from "./consistency";
import { addBusinessDays, addDays } from "./calendar";
import { assessI9 } from "./i9";
import { Flag, FlagType, WorkdayNewHireEvent } from "./types";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const DIRECTORY: DirectoryEntry[] = [
  { workerId: "B-1", site: "Leeds", team: "Ops", level: 3, tenureMonths: 12, buddyLoad: 0 },
  { workerId: "B-2", site: "Leeds", team: "Ops", level: 4, tenureMonths: 30, buddyLoad: 1 },
  { workerId: "B-3", site: "London", team: "Ops", level: 3, tenureMonths: 40, buddyLoad: 0 },
  { workerId: "M-200", site: "Leeds", team: "Ops", level: 6, tenureMonths: 60, buddyLoad: 0, isManager: true },
];

const SENIOR_DIRECTORY: DirectoryEntry[] = [
  { workerId: "B-SR", site: "Leeds", team: "Ops", level: 6, tenureMonths: 40, buddyLoad: 0 },
  { workerId: "B-OK", site: "Leeds", team: "Ops", level: 3, tenureMonths: 12, buddyLoad: 0 },
  { workerId: "B-OK2", site: "Leeds", team: "Sales", level: 4, tenureMonths: 8, buddyLoad: 1 },
];

function hireEvent(over: Partial<WorkdayNewHireEvent> = {}): WorkdayNewHireEvent {
  return {
    eventType: "new_hire",
    workerId: "W-1001",
    workerType: "employee",
    offerWorkerType: "employee",
    startDate: "2026-10-26",
    location: "Leeds",
    site: "Leeds",
    team: "Finance",
    roleFamily: "Analyst",
    jobLevel: 3,
    managerId: "M-200",
    ...over,
  };
}

function email(over: Partial<IntakeEmail> = {}): IntakeEmail {
  return { messageId: "m-1", sender: "hr@example.com", threadId: "t-1", body: "Worker type confirmed", ...over };
}

function intake(caseId: string | null, intent: string, confidence: number, workerType?: string): unknown {
  return {
    case_id: caseId,
    intent,
    fields: workerType ? { worker_type: workerType } : {},
    confidence,
    evidence_quote: "quoted text",
  };
}

function classifier(output: unknown): IntakeClassifier {
  return async () => output;
}

interface Harness {
  store: Store;
  sandbox: SandboxSystems;
  orch: Orchestrator;
  clock: { now: Date };
}

function harness(opts: { file?: string; sandbox?: SandboxSystems; clock?: { now: Date }; directory?: DirectoryEntry[] } = {}): Harness {
  const store = new Store(opts.file);
  const sandbox = opts.sandbox ?? new SandboxSystems();
  const clock = opts.clock ?? { now: new Date("2026-10-26T09:00:00Z") };
  const orch = new Orchestrator({
    store,
    adapter: sandbox,
    now: () => clock.now,
    calendar: NO_HOLIDAYS,
    directory: opts.directory ?? DIRECTORY,
    retry: { retries: 3, baseDelayMs: 0 },
  });
  return { store, sandbox, orch, clock };
}

function setDay(h: Harness, iso: string): void {
  h.clock.now = new Date(`${iso}T09:00:00Z`);
}

function openFlags(store: Store, type: FlagType): Flag[] {
  return Object.values(store.state.flags).filter((f) => f.type === type && f.status === "OPEN");
}

// ─── Unit: calendar, gate, I-9, buddy ───────────────────────────────────────

describe("calendar", () => {
  test("business days skip weekends", () => {
    assert.equal(addBusinessDays("2026-10-23", 1, NO_HOLIDAYS), "2026-10-26"); // Fri to Mon
    assert.equal(addBusinessDays("2026-10-26", 3, NO_HOLIDAYS), "2026-10-29"); // Mon to Thu
    assert.equal(addBusinessDays("2026-10-26", -1, NO_HOLIDAYS), "2026-10-23"); // Mon back to Fri
    assert.equal(addDays("2026-10-26", 14), "2026-11-09");
  });
});

describe("R3 consistency gate", () => {
  test("assigns only when all sources and linked records agree", () => {
    const ok = evaluateTrackGate("W", { workday: "employee", offer: "employee", email: "employee", linked: [] });
    assert.deepEqual(ok, { status: "ASSIGNED", track: "employee" });
  });

  test("a missing email source is ambiguous", () => {
    const r = evaluateTrackGate("W", { workday: "employee", offer: "employee" });
    assert.equal(r.status, "AMBIGUOUS");
  });

  test("a linked contractor record is ambiguous and cited", () => {
    const r = evaluateTrackGate("W-2", {
      workday: "employee",
      offer: "employee",
      email: "employee",
      linked: [{ workerId: "W-1", workerType: "contractor" }],
    });
    assert.equal(r.status, "AMBIGUOUS");
    assert.ok(r.status === "AMBIGUOUS" && r.reasons.some((x) => x.includes("W-1")));
  });
});

describe("R6 I-9 assessment", () => {
  test("alert one business day before, breach only after the deadline", () => {
    const status = { section1Done: true, section2Done: false };
    assert.deepEqual(assessI9("2026-10-26", status, "2026-10-27", NO_HOLIDAYS), []);
    assert.deepEqual(assessI9("2026-10-26", status, "2026-10-28", NO_HOLIDAYS), [
      { section: 2, deadline: "2026-10-29", status: "alert" },
    ]);
    assert.deepEqual(assessI9("2026-10-26", status, "2026-10-29", NO_HOLIDAYS), [
      { section: 2, deadline: "2026-10-29", status: "alert" },
    ]);
    assert.deepEqual(assessI9("2026-10-26", status, "2026-10-30", NO_HOLIDAYS), [
      { section: 2, deadline: "2026-10-29", status: "breach" },
    ]);
  });
});

// ─── Validation scenarios ───────────────────────────────────────────────────

describe("validation scenarios", () => {
  test("V1 happy path: full plan runs, one human touch, replay creates nothing new", async () => {
    const h = harness();
    const { caseId, created } = h.orch.createCase(hireEvent());
    assert.equal(created, true);

    await h.orch.handleIntake(email(), classifier(intake(caseId, "worker_type", 0.95, "employee")));
    await h.orch.run(caseId);

    const [buddy] = openFlags(h.store, "BUDDY_CONFIRM");
    assert.ok(buddy, "buddy confirmation is the only human step");
    h.orch.decideFlag(buddy.id, "approve", { workerId: "B-1" }, "human:tal");
    await h.orch.run(caseId);

    const c = h.store.state.cases[caseId];
    assert.equal(c.state, "READY_DAY1");
    assert.equal(c.track, "employee");
    assert.ok(h.orch.tasksOf(caseId).every((t) => t.status === "DONE"));

    const effects = h.sandbox.sideEffects.length;
    await h.orch.run(caseId);
    const replay = h.orch.createCase(hireEvent());
    assert.equal(replay.created, false);
    assert.equal(replay.caseId, caseId);
    assert.equal(h.sandbox.sideEffects.length, effects, "replay makes no duplicate writes");
    assert.equal(Object.keys(h.store.state.cases).length, 1);

    const m = metrics(h.store);
    assert.equal(m.humanTouchesPerCase, 1);

    setDay(h, "2026-11-09"); // start + 14
    await h.orch.tick();
    assert.equal(h.store.state.cases[caseId].state, "CLOSED");
  });

  test("V2 rehire with a contractor history: no track until a human decides", async () => {
    const sandbox = new SandboxSystems();
    sandbox.setLinkedRecords("W-2002", [{ workerId: "W-1001", workerType: "contractor" }]);
    const h = harness({ sandbox });

    const { caseId } = h.orch.createCase(hireEvent({ workerId: "W-2002", eventType: "rehire" }));
    await h.orch.handleIntake(email(), classifier(intake(caseId, "worker_type", 0.95, "employee")));
    await h.orch.run(caseId);

    const c = h.store.state.cases[caseId];
    assert.equal(c.track, null);
    assert.equal(sandbox.sideEffects.filter((e) => e.tool === "lms_assign_course").length, 0);

    const [flag] = openFlags(h.store, "TRACK_AMBIGUOUS");
    assert.ok(flag);
    const evidence = JSON.stringify(flag.evidence);
    assert.ok(evidence.includes("W-1001") && evidence.includes("W-2002"), "flag cites both records");

    h.orch.decideFlag(flag.id, "employee", {}, "human:hr-lead");
    await h.orch.run(caseId);
    assert.equal(h.store.state.cases[caseId].track, "employee");
    assert.equal(sandbox.sideEffects.filter((e) => e.tool === "lms_assign_course").length, 1);
  });

  test("V3 ServiceNow outage: retry cap, escalation, no duplicates, resumes after restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hr-onboarding-"));
    const file = join(dir, "state.json");
    try {
      const sandbox = new SandboxSystems();
      const clock = { now: new Date("2026-10-25T09:00:00Z") }; // day before start
      const h = harness({ file, sandbox, clock });
      sandbox.failTool("servicenow_create_request", Infinity, "HTTP 503 Service Unavailable");

      const { caseId } = h.orch.createCase(hireEvent());
      await h.orch.handleIntake(email(), classifier(intake(caseId, "worker_type", 0.95, "employee")));
      await h.orch.run(caseId);

      const it = h.store.state.tasks[`${caseId}:it_request`];
      assert.equal(it.status, "FAILED");
      assert.equal(it.attempts, 4, "first attempt plus three retries");
      assert.equal(sandbox.sideEffects.filter((e) => e.tool === "servicenow_create_request").length, 0);

      const [esc] = openFlags(h.store, "TASK_ESCALATED");
      assert.ok(esc, "escalation raised");
      assert.equal(Date.parse(esc.dueAt) - Date.parse(esc.raisedAt), 3_600_000, "HR sees it within one hour");

      const before = digest(h.store, "2026-10-25");
      assert.ok(before.dayOneRisk.includes(caseId), "case is at day-1 risk in the digest");

      // Process restart: a fresh orchestrator reads the persisted state.
      const restarted = harness({ file, sandbox, clock });
      assert.equal(restarted.store.state.tasks[`${caseId}:it_request`].status, "FAILED");
      await restarted.orch.tick();
      assert.equal(restarted.store.state.tasks[`${caseId}:it_request`].status, "FAILED", "still down");

      sandbox.recover("servicenow_create_request");
      await restarted.orch.tick();
      assert.equal(restarted.store.state.tasks[`${caseId}:it_request`].status, "DONE");
      assert.equal(sandbox.sideEffects.filter((e) => e.tool === "servicenow_create_request").length, 1);
      assert.equal(restarted.store.state.flags[esc.id].status, "AUTO_RESOLVED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("V4 I-9 boundary: flags on the day after the deadline and never acts on a manager's instruction", async () => {
    const h = harness();
    const { caseId } = h.orch.createCase(hireEvent());
    h.orch.recordI9(caseId, 1, true, "human:hr-1");

    await h.orch.handleIntake(
      email({ messageId: "m-9", sender: "manager@example.com", body: "just put them on hold" }),
      classifier(intake(caseId, "other", 0.97)),
    );
    assert.equal(openFlags(h.store, "INTAKE_REVIEW").length, 1, "manager email goes to a human");

    setDay(h, "2026-10-29"); // day 3, the deadline itself
    await h.orch.tick();
    assert.equal(openFlags(h.store, "I9_LATE").length, 0);

    setDay(h, "2026-10-30"); // day 4
    await h.orch.tick();
    const [flag] = openFlags(h.store, "I9_LATE");
    assert.ok(flag, "breach flagged");
    assert.equal(flag.owner, "hr-compliance");
    assert.equal(flag.slaHours, 4);
    assert.equal((flag.evidence as { deadline: string }).deadline, "2026-10-29");

    const c = h.store.state.cases[caseId];
    assert.equal(c.i9.section2Done, false, "agent does not change I-9 state");
    const holdTools = Object.getOwnPropertyNames(SandboxSystems.prototype).filter((n) => /hold|release/i.test(n));
    assert.deepEqual(holdTools, [], "no tool can place or release a hold");
    assert.equal(metrics(h.store).i9Breaches, 1);
  });

  test("V5 seniority norm: best match three levels senior is flagged, not confirmed", async () => {
    const h = harness({ directory: SENIOR_DIRECTORY });
    const { caseId } = h.orch.createCase(hireEvent({ team: "Finance" }));
    await h.orch.handleIntake(email(), classifier(intake(caseId, "worker_type", 0.95, "employee")));
    await h.orch.run(caseId);

    const [flag] = openFlags(h.store, "BUDDY_SENIORITY");
    assert.ok(flag, "seniority flag raised");
    const proposals = (flag.evidence as { proposals: { workerId: string; rationale: string }[] }).proposals;
    assert.equal(proposals.length, 3, "top three candidates shown");
    assert.ok(proposals.every((p) => p.rationale.length > 0), "each has a rationale");

    assert.equal(h.store.state.cases[caseId].buddy?.confirmedWorkerId, null);
    assert.notEqual(h.store.state.tasks[`${caseId}:buddy_proposal`].status, "DONE");

    h.orch.decideFlag(flag.id, "approve", { workerId: "B-OK" }, "human:hr-ops");
    await h.orch.run(caseId);
    assert.equal(h.store.state.cases[caseId].buddy?.confirmedWorkerId, "B-OK");
  });
});

// ─── Intake, decisions and data gaps ────────────────────────────────────────

describe("R4 intake and R8 decisions", () => {
  test("schema-invalid output is retried once, then queued for a human", async () => {
    const h = harness();
    h.orch.createCase(hireEvent());
    let calls = 0;
    const bad: IntakeClassifier = async () => {
      calls += 1;
      return { nonsense: true };
    };
    const result = await h.orch.handleIntake(email(), bad);
    assert.equal(calls, 2);
    assert.equal(result.outcome, "queued");
    assert.equal(openFlags(h.store, "INTAKE_REVIEW").length, 1);
  });

  test("low confidence is queued and never applied", async () => {
    const h = harness();
    const { caseId } = h.orch.createCase(hireEvent());
    const result = await h.orch.handleIntake(email(), classifier(intake(caseId, "worker_type", 0.5, "contractor")));
    assert.equal(result.outcome, "queued");
    assert.equal(h.store.state.cases[caseId].trackSources.email, undefined);
  });

  test("only a named human can decide a flag", async () => {
    const h = harness();
    const { caseId } = h.orch.createCase(hireEvent({ workerType: undefined }));
    const [flag] = openFlags(h.store, "DATA_MISSING");
    assert.ok(flag);
    assert.throws(() => h.orch.decideFlag(flag.id, "resolved", { workerType: "employee" }, "agent"), /named human/);
    assert.equal(h.store.state.flags[flag.id].status, "OPEN");
    assert.equal(h.store.state.cases[caseId].state, "PLANNED");
  });

  test("missing data raises DATA_MISSING and planning waits for the decision", async () => {
    const h = harness();
    const { caseId } = h.orch.createCase(hireEvent({ workerType: undefined }));
    assert.equal(h.orch.tasksOf(caseId).length, 0, "no tasks planned yet");
    const [flag] = openFlags(h.store, "DATA_MISSING");
    assert.deepEqual((flag.evidence as { missing: string[] }).missing, ["workerType"]);

    h.orch.decideFlag(flag.id, "resolved", { workerType: "employee" }, "human:hr-ops");
    assert.equal(h.orch.tasksOf(caseId).length, 7, "plan created after the fix");
  });

  test("a flag cannot be decided twice", async () => {
    const h = harness();
    const { caseId } = h.orch.createCase(hireEvent());
    await h.orch.handleIntake(email(), classifier(intake(caseId, "worker_type", 0.95, "employee")));
    await h.orch.run(caseId);
    const [buddy] = openFlags(h.store, "BUDDY_CONFIRM");
    h.orch.decideFlag(buddy.id, "approve", { workerId: "B-1" }, "human:tal");
    assert.throws(() => h.orch.decideFlag(buddy.id, "approve", { workerId: "B-1" }, "human:tal"), /already DECIDED/);
  });

  test("a digest lists only open items and metrics come from logs", async () => {
    const h = harness();
    const { caseId } = h.orch.createCase(hireEvent());
    await h.orch.handleIntake(email(), classifier(intake(caseId, "worker_type", 0.95, "employee")));
    await h.orch.run(caseId);
    const d = digest(h.store, "2026-10-26");
    assert.equal(d.openFlags.length, 1);
    assert.equal(d.openFlags[0].type, "BUDDY_CONFIRM");
    const m = metrics(h.store);
    assert.ok(m.automatedTaskShare > 0 && m.automatedTaskShare < 1);
    assert.equal(m.falseFlagRate, null);
  });
});
