import { randomUUID } from "crypto";
import { addBusinessDays, addDays, Calendar, isValidDate, onOrBeforeBusinessDay, utcDate } from "./calendar";
import { evaluateTrackGate, GateResult, isWorkerType } from "./consistency";
import { assessI9 } from "./i9";
import { BuddyPolicy, DEFAULT_BUDDY_POLICY, DirectoryEntry, proposeBuddies } from "./buddy";
import {
  AUTO_ACCEPT_INTENTS,
  classifyIntake,
  INTAKE_CONFIDENCE_FLOOR,
  IntakeClassifier,
  IntakeEmail,
  IntakeOutput,
} from "./intake";
import { RetryPolicy, withRetry } from "./retry";
import { SourceAdapter, ToolRunner } from "./tools";
import { Store } from "./store";
import { TASK_TEMPLATES, TEMPLATE_VERSION } from "./templates";
import {
  CaseState,
  CompleteHire,
  FlagType,
  Flag,
  HireRecord,
  OnboardingCase,
  Task,
  TaskKey,
  WorkdayNewHireEvent,
  WorkerType,
} from "./types";

const AGENT = "agent";
const SYSTEM = "system";
const CLOSE_AFTER_DAYS = 14;

/** Hours to respond. The spec says business hours; this uses elapsed hours (see REVIEW.md). */
const SLA_HOURS: Record<FlagType, number> = {
  DATA_MISSING: 24,
  TRACK_AMBIGUOUS: 24,
  BUDDY_CONFIRM: 24,
  BUDDY_SENIORITY: 24,
  BUDDY_NO_MATCH: 24,
  I9_LATE: 4,
  TASK_ESCALATED: 1,
  INTAKE_REVIEW: 24,
};

const DEFAULT_OWNERS: Record<FlagType, string> = {
  DATA_MISSING: "hr-ops",
  TRACK_AMBIGUOUS: "hr-ops-lead",
  BUDDY_CONFIRM: "hr-ops",
  BUDDY_SENIORITY: "hr-ops",
  BUDDY_NO_MATCH: "hr-ops",
  I9_LATE: "hr-compliance",
  TASK_ESCALATED: "hr-ops",
  INTAKE_REVIEW: "hr-ops",
};

const OPTIONS: Record<FlagType, string[]> = {
  DATA_MISSING: ["resolved"],
  TRACK_AMBIGUOUS: ["employee", "contractor"],
  BUDDY_CONFIRM: ["approve", "reject"],
  BUDDY_SENIORITY: ["approve", "reject"],
  BUDDY_NO_MATCH: ["approve", "reject"],
  I9_LATE: ["hold_placed_by_hr", "resolved", "dismissed"],
  TASK_ESCALATED: ["resolved_manually", "retry"],
  INTAKE_REVIEW: ["worker_type", "dismissed"],
};

// DATA_MISSING applies only to these fields (fixtures README, labelling rule 1).
// A null worker type or offer type is handled by the R3 gate instead.
const REQUIRED_FIELDS = ["location", "jobLevel", "managerId"] as const;

/** Site is the hire's location. Team comes from the manager, so it is checked separately in createCase. */
export function missingFields(event: WorkdayNewHireEvent): string[] {
  const missing: string[] = [];
  if (!event.workerId) missing.push("workerId");
  for (const field of REQUIRED_FIELDS) {
    const value = event[field];
    if (value === undefined || value === null || value === "") missing.push(field);
  }
  if (!isValidDate(event.startDate)) missing.push("startDate");
  return missing;
}

/** I-9 applies to US hires who are not contractors. A null worker type is tracked. */
export function i9Applies(h: { country?: string | null; workerType?: string | null }): boolean {
  return h.country === "US" && h.workerType !== "contractor";
}

function requireComplete(c: OnboardingCase): CompleteHire {
  if (c.missingFields.length > 0) {
    throw new Error(`Case ${c.id} is missing fields: ${c.missingFields.join(", ")}`);
  }
  return c.hire as CompleteHire;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Attempt = { kind: "done"; result: unknown; completedBy: string } | { kind: "blocked" };

export interface OrchestratorConfig {
  store: Store;
  adapter: SourceAdapter;
  now: () => Date;
  calendar: Calendar;
  directory: DirectoryEntry[];
  buddyPolicy?: BuddyPolicy;
  /** "always" confirms every buddy with a human (matches V1). "on_flag" only when seniority is crossed. */
  buddyConfirmation?: "always" | "on_flag";
  owners?: Partial<Record<FlagType, string>>;
  retry?: RetryPolicy;
}

export interface IntakeResult {
  outcome: "applied" | "queued";
  caseId: string | null;
  flagId: string | null;
}

export class Orchestrator {
  private readonly store: Store;
  private readonly tools: ToolRunner;
  private readonly now: () => Date;
  private readonly calendar: Calendar;
  private readonly directory: DirectoryEntry[];
  private readonly buddyPolicy: BuddyPolicy;
  private readonly buddyConfirmation: "always" | "on_flag";
  private readonly owners: Record<FlagType, string>;
  private readonly retry: RetryPolicy;

  constructor(cfg: OrchestratorConfig) {
    this.store = cfg.store;
    this.now = cfg.now;
    this.tools = new ToolRunner(cfg.adapter, cfg.store, cfg.now);
    this.calendar = cfg.calendar;
    this.directory = cfg.directory;
    this.buddyPolicy = cfg.buddyPolicy ?? DEFAULT_BUDDY_POLICY;
    this.buddyConfirmation = cfg.buddyConfirmation ?? "always";
    this.owners = { ...DEFAULT_OWNERS, ...cfg.owners };
    this.retry = cfg.retry ?? { retries: 3, baseDelayMs: 1000 };
  }

  // ─── R1: case creation ──────────────────────────────────────────────────────

  createCase(event: WorkdayNewHireEvent, actor: string = SYSTEM): { caseId: string; created: boolean } {
    const key = `${event.workerId}|${event.startDate ?? ""}`;
    const existing = Object.values(this.store.state.cases).find((c) => c.key === key);
    if (existing) {
      this.audit(actor, "case.duplicate_event", existing.id, { key }, { caseId: existing.id });
      this.store.save();
      return { caseId: existing.id, created: false };
    }

    // Team is taken from the manager's record. An unknown manager is missing data.
    const manager = this.directory.find((d) => d.workerId === event.managerId);
    const missing = missingFields(event);
    if (event.managerId && !manager && !missing.includes("managerId")) missing.push("managerId");

    const c: OnboardingCase = {
      id: randomUUID(),
      key,
      state: "PLANNED",
      templateVersion: TEMPLATE_VERSION,
      hire: { ...event, team: manager?.team ?? null },
      missingFields: missing,
      trackSources: {},
      track: null,
      i9: { section1Done: false, section2Done: false },
      i9Alerts: [],
      buddy: null,
      buddyPreference: null,
      createdAt: this.nowIso(),
      closedAt: null,
    };
    this.store.state.cases[c.id] = c;
    this.audit(actor, "case.created", c.id, { key, eventType: event.eventType }, { missing });

    if (missing.length > 0) {
      this.raiseFlag({
        caseId: c.id,
        type: "DATA_MISSING",
        dedupeKey: `DATA_MISSING:${c.id}`,
        rule: "R1 required fields present",
        evidence: { missing },
      });
    } else {
      this.planTasks(c);
    }
    this.refresh(c);
    this.store.save();
    return { caseId: c.id, created: true };
  }

  // ─── R2: task plan ──────────────────────────────────────────────────────────

  private planTasks(c: OnboardingCase): void {
    const h = requireComplete(c);
    for (const tpl of TASK_TEMPLATES) {
      const id = `${c.id}:${tpl.key}`;
      if (this.store.state.tasks[id]) continue;
      // A due date on a non-business day moves back to the previous business day.
      const dueDate =
        tpl.offset.unit === "business_days"
          ? addBusinessDays(h.startDate, tpl.offset.days, this.calendar)
          : onOrBeforeBusinessDay(addDays(h.startDate, tpl.offset.days), this.calendar);
      const task: Task = {
        id,
        caseId: c.id,
        key: tpl.key,
        system: tpl.system,
        owner: tpl.owner,
        dueDate,
        dependsOn: [...tpl.dependsOn],
        status: "PENDING",
        attempts: 0,
        lastError: null,
        result: null,
        completedBy: null,
      };
      this.store.state.tasks[id] = task;
    }
    this.audit(SYSTEM, "plan.created", c.id, { templateVersion: c.templateVersion }, { tasks: TASK_TEMPLATES.length });
  }

  // ─── Execution ──────────────────────────────────────────────────────────────

  /** Runs every task whose dependencies are done. Each task is attempted at most once per call. */
  async run(caseId: string): Promise<void> {
    const c = this.requireCase(caseId);
    if (c.state !== "CLOSED" && c.missingFields.length === 0) {
      const attempted = new Set<string>();
      for (;;) {
        const next = this.tasksOf(c.id).find((t) => !attempted.has(t.id) && t.status !== "DONE" && this.depsDone(t));
        if (!next) break;
        attempted.add(next.id);
        await this.executeTask(c, next);
      }
    }
    this.refresh(c);
    this.store.save();
  }

  private async executeTask(c: OnboardingCase, t: Task): Promise<void> {
    const outcome = await withRetry(() => {
      t.attempts += 1;
      return this.attemptTask(c, t);
    }, this.retry);

    if (!outcome.ok) {
      const message = describeError(outcome.error);
      t.status = "FAILED";
      t.lastError = message;
      this.raiseFlag({
        caseId: c.id,
        type: "TASK_ESCALATED",
        dedupeKey: `TASK_ESCALATED:${t.id}`,
        rule: `R9 retry cap (${this.retry.retries}) reached for ${t.key}`,
        evidence: { taskId: t.id, system: t.system, attempts: outcome.attempts, error: message },
      });
      this.audit(AGENT, "task.failed", c.id, { taskId: t.id }, { error: message, attempts: outcome.attempts });
      return;
    }

    const attempt = outcome.value;
    if (attempt.kind === "blocked") {
      t.status = "BLOCKED";
      t.lastError = null;
      return;
    }
    this.markTaskDone(t, attempt.completedBy, attempt.result);
    this.autoResolve(`TASK_ESCALATED:${t.id}`, "task completed on a later attempt");
  }

  private async attemptTask(c: OnboardingCase, t: Task): Promise<Attempt> {
    const h = requireComplete(c);
    const rk = `${c.id}:${t.key}`;
    const ctx = { actor: AGENT, caseId: c.id, requestKey: rk };

    switch (t.key) {
      case "it_request": {
        const result = await this.tools.invoke(
          "servicenow_create_request",
          { workerId: h.workerId, roleFamily: h.roleFamily ?? null },
          ctx,
        );
        return { kind: "done", result, completedBy: AGENT };
      }

      case "welcome_email": {
        const result = await this.tools.invoke(
          "email_send_template",
          { to: h.workerId, template: "welcome", vars: { startDate: h.startDate } },
          ctx,
        );
        return { kind: "done", result, completedBy: AGENT };
      }

      case "benefits_reminder": {
        const result = await this.tools.invoke(
          "email_send_template",
          { to: h.workerId, template: "benefits_enrolment", vars: { startDate: h.startDate } },
          ctx,
        );
        return { kind: "done", result, completedBy: AGENT };
      }

      case "checkpoint_30d": {
        const result = await this.tools.invoke(
          "calendar_schedule",
          { title: "30-day checkpoint", attendees: [h.workerId, h.managerId], date: addDays(h.startDate, 30) },
          ctx,
        );
        return { kind: "done", result, completedBy: AGENT };
      }

      case "track_assign": {
        let track: WorkerType | null = c.track;
        if (track === null) {
          const gate = await this.evaluateGate(c, h);
          if (gate.status === "AMBIGUOUS") {
            this.raiseFlag({
              caseId: c.id,
              type: "TRACK_AMBIGUOUS",
              dedupeKey: `TRACK_AMBIGUOUS:${c.id}`,
              rule: "R3 worker-type consistency gate",
              evidence: gate,
            });
            return { kind: "blocked" };
          }
          track = gate.track;
          c.track = track;
          this.autoResolve(`TRACK_AMBIGUOUS:${c.id}`, "sources agree on re-check");
          this.audit(AGENT, "track.assigned", c.id, {}, { track });
        }
        const result = await this.tools.invoke("lms_assign_course", { workerId: h.workerId, track }, ctx);
        return { kind: "done", result, completedBy: AGENT };
      }

      case "buddy_proposal": {
        if (c.buddy?.confirmedWorkerId) {
          return {
            kind: "done",
            result: { workerId: c.buddy.confirmedWorkerId },
            completedBy: c.buddy.confirmedBy ?? AGENT,
          };
        }
        if (c.buddy?.rejected) return { kind: "blocked" };

        const res = proposeBuddies(
          { workerId: h.workerId, site: h.location, team: h.team, jobLevel: h.jobLevel, startDate: h.startDate },
          this.directory,
          this.buddyPolicy,
        );
        c.buddy = {
          proposals: res.proposals,
          seniorityCrossed: res.seniorityCrossed,
          confirmedWorkerId: null,
          confirmedBy: null,
          rejected: false,
        };

        if (res.proposals.length === 0) {
          this.raiseFlag({
            caseId: c.id,
            type: "BUDDY_NO_MATCH",
            dedupeKey: `BUDDY_NO_MATCH:${c.id}`,
            rule: "R7 no candidate meets the buddy rules",
            evidence: { policy: this.buddyPolicy, site: h.location, team: h.team },
          });
          return { kind: "blocked" };
        }
        if (res.seniorityCrossed) {
          this.raiseFlag({
            caseId: c.id,
            type: "BUDDY_SENIORITY",
            dedupeKey: `BUDDY_SENIORITY:${c.id}`,
            rule: `R7 top-ranked buddy's absolute level gap exceeds ${this.buddyPolicy.maxLevelGap}`,
            evidence: { proposals: res.proposals, maxLevelGap: this.buddyPolicy.maxLevelGap },
          });
          return { kind: "blocked" };
        }
        if (this.buddyConfirmation === "always") {
          this.raiseFlag({
            caseId: c.id,
            type: "BUDDY_CONFIRM",
            dedupeKey: `BUDDY_CONFIRM:${c.id}`,
            rule: "R7 buddy confirmation by a named human",
            evidence: { proposals: res.proposals },
          });
          return { kind: "blocked" };
        }
        const top = res.proposals[0];
        c.buddy.confirmedWorkerId = top.workerId;
        c.buddy.confirmedBy = AGENT;
        return { kind: "done", result: { workerId: top.workerId }, completedBy: AGENT };
      }

      case "handoff_pack": {
        const tasks = this.tasksOf(c.id).filter((x) => x.key !== "handoff_pack");
        const openFlags = Object.values(this.store.state.flags).filter((f) => f.caseId === c.id && f.status === "OPEN");
        const lines = tasks.map((x) => `${x.key}: ${x.status}`);
        const summary = [
          `Onboarding handoff for ${h.workerId}, starts ${h.startDate}, manager ${h.managerId}.`,
          ...lines,
          `Open flags: ${openFlags.length}`,
        ].join("\n");
        return { kind: "done", result: { summary }, completedBy: AGENT };
      }
    }
  }

  private async evaluateGate(c: OnboardingCase, h: CompleteHire): Promise<GateResult> {
    const worker = await this.tools.invoke("workday_get_worker", { workerId: h.workerId }, { actor: AGENT, caseId: c.id });
    c.trackSources = {
      workday: h.workerType,
      offer: h.offerWorkerType,
      email: c.trackSources.email,
      linked: worker.linkedRecords,
    };
    return evaluateTrackGate(h.workerId, c.trackSources);
  }

  // ─── R6: I-9 monitor ────────────────────────────────────────────────────────

  /** Records I-9 status from HR. The agent never sets a hold. */
  recordI9(caseId: string, section: 1 | 2, done: boolean, actor: string): void {
    const c = this.requireCase(caseId);
    if (section === 1) c.i9.section1Done = done;
    else c.i9.section2Done = done;
    this.audit(actor, "i9.recorded", caseId, { section, done }, null);
    this.refresh(c);
    this.store.save();
  }

  private checkI9(c: OnboardingCase): void {
    if (c.missingFields.length > 0) return;
    const h = requireComplete(c);
    if (!i9Applies(h)) return;
    const today = this.today();
    for (const finding of assessI9(h.startDate, c.i9, today, this.calendar)) {
      if (finding.status === "breach") {
        this.raiseFlag({
          caseId: c.id,
          type: "I9_LATE",
          dedupeKey: `I9_LATE:${c.id}:s${finding.section}`,
          rule: `R6 Section ${finding.section} deadline passed`,
          evidence: { section: finding.section, deadline: finding.deadline, today, i9: { ...c.i9 } },
        });
      } else {
        const key = `s${finding.section}:${finding.deadline}`;
        if (!c.i9Alerts.includes(key)) {
          c.i9Alerts.push(key);
          this.audit(AGENT, "i9.alert", c.id, { section: finding.section }, { deadline: finding.deadline });
        }
      }
    }
  }

  // ─── Time-based progress ────────────────────────────────────────────────────

  /** Resumes every open case. Safe to call repeatedly. */
  async tick(): Promise<void> {
    for (const c of Object.values(this.store.state.cases)) {
      if (c.state === "CLOSED") continue;
      await this.run(c.id);
      this.checkI9(c);
      this.refresh(c);
    }
    this.store.save();
  }

  // ─── R4: intake ─────────────────────────────────────────────────────────────

  async handleIntake(email: IntakeEmail, classify: IntakeClassifier): Promise<IntakeResult> {
    const parsed = await classifyIntake(email, classify);
    if (!parsed.ok) {
      const flag = this.raiseFlag({
        caseId: null,
        type: "INTAKE_REVIEW",
        dedupeKey: `INTAKE:${email.messageId}`,
        rule: "R4 output failed schema validation after one retry",
        evidence: { messageId: email.messageId, sender: email.sender, error: parsed.error },
      });
      this.audit(AGENT, "intake.schema_failed", null, { messageId: email.messageId }, { error: parsed.error });
      this.store.save();
      return { outcome: "queued", caseId: null, flagId: flag.id };
    }

    const out = parsed.value;
    const target = out.case_id ? this.store.state.cases[out.case_id] : undefined;
    const intent = out.intents.length === 1 ? out.intents[0] : null;
    this.audit(
      AGENT,
      "intake.classified",
      target?.id ?? null,
      { messageId: email.messageId, sender: email.sender },
      { intents: out.intents, confidence: out.confidence, case_id: out.case_id, evidence_quote: out.evidence_quote },
    );

    const reasons: string[] = [];
    if (!target) reasons.push("no matching case");
    if (out.confidence < INTAKE_CONFIDENCE_FLOOR) reasons.push(`confidence ${out.confidence} below ${INTAKE_CONFIDENCE_FLOOR}`);
    if (out.intents.length > 1) reasons.push(`multiple intents: ${out.intents.join(", ")}`);
    if (intent !== null && !AUTO_ACCEPT_INTENTS.has(intent)) reasons.push(`intent "${intent}" is routed to a human`);
    if (out.suspected_prompt_injection) reasons.push("suspected prompt injection");

    const wt: unknown = out.fields["worker_type"];
    if (intent === "worker_type_clarification" && !isWorkerType(wt)) {
      reasons.push("worker_type field missing or unrecognised");
    }

    if (reasons.length === 0 && target && intent !== null) {
      this.applyIntake(target, intent, out, email);
      this.refresh(target);
      this.store.save();
      return { outcome: "applied", caseId: target.id, flagId: null };
    }

    const flag = this.raiseFlag({
      caseId: target?.id ?? null,
      type: "INTAKE_REVIEW",
      dedupeKey: `INTAKE:${email.messageId}`,
      rule: "R4 intake routed to human review",
      evidence: {
        messageId: email.messageId,
        sender: email.sender,
        reasons,
        intents: out.intents,
        confidence: out.confidence,
        evidence_quote: out.evidence_quote,
      },
    });
    this.store.save();
    return { outcome: "queued", caseId: target?.id ?? null, flagId: flag.id };
  }

  /**
   * Records an auto-accepted intent. Only worker_type_clarification changes state,
   * and it only feeds the R3 gate. Other intents are recorded and never acted on.
   * I-9 documents are a signal only, and a buddy preference is never a confirmation.
   */
  private applyIntake(target: OnboardingCase, intent: string, out: IntakeOutput, email: IntakeEmail): void {
    switch (intent) {
      case "worker_type_clarification": {
        const wt = out.fields["worker_type"];
        if (!isWorkerType(wt)) throw new Error("worker_type_clarification without a valid worker_type");
        target.trackSources.email = wt;
        this.audit(AGENT, "intake.worker_type_recorded", target.id, { messageId: email.messageId }, { workerType: wt });
        return;
      }
      case "buddy_preference":
        target.buddyPreference = out.fields["preference"] ?? out.evidence_quote;
        this.audit(AGENT, "intake.buddy_preference_recorded", target.id, { messageId: email.messageId }, { recorded: true });
        return;
      default:
        // start_date_change, equipment_request, i9_documents_submitted: recorded as a signal only.
        this.audit(AGENT, "intake.signal", target.id, { messageId: email.messageId, intent }, { fields: out.fields });
    }
  }

  // ─── R8: flag queue ─────────────────────────────────────────────────────────

  /** Records a human decision. Only a named human may decide, and the outcome must be an allowed option. */
  decideFlag(flagId: string, outcome: string, detail: Record<string, unknown>, actor: string): void {
    if (!actor.startsWith("human:")) {
      throw new Error("Flag decisions must come from a named human (actor 'human:<id>')");
    }
    const flag = this.store.state.flags[flagId];
    if (!flag) throw new Error(`Unknown flag ${flagId}`);
    if (flag.status !== "OPEN") throw new Error(`Flag ${flagId} is already ${flag.status}`);
    if (!flag.options.includes(outcome)) {
      throw new Error(`Outcome "${outcome}" is not valid for ${flag.type}; allowed: ${flag.options.join(", ")}`);
    }
    const c = flag.caseId ? this.store.state.cases[flag.caseId] : undefined;

    switch (flag.type) {
      case "TRACK_AMBIGUOUS": {
        this.need(c, flag).track = outcome as WorkerType;
        break;
      }

      case "BUDDY_CONFIRM":
      case "BUDDY_SENIORITY":
      case "BUDDY_NO_MATCH": {
        const cc = this.need(c, flag);
        if (!cc.buddy) throw new Error(`Case ${cc.id} has no buddy proposal to decide`);
        if (outcome === "reject") {
          cc.buddy.rejected = true;
          this.setTaskStatus(cc.id, "buddy_proposal", "BLOCKED");
          break;
        }
        const workerId = detail["workerId"];
        if (typeof workerId !== "string") throw new Error("approve requires detail.workerId");
        const allowed =
          flag.type === "BUDDY_NO_MATCH"
            ? this.directory.some((d) => d.workerId === workerId)
            : cc.buddy.proposals.some((p) => p.workerId === workerId);
        if (!allowed) throw new Error(`${workerId} is not an eligible buddy for this case`);
        cc.buddy.confirmedWorkerId = workerId;
        cc.buddy.confirmedBy = actor;
        this.markTaskDone(this.taskOf(cc.id, "buddy_proposal"), actor, { workerId });
        break;
      }

      case "I9_LATE":
        // Recorded for audit only. The agent takes no action on a hold.
        break;

      case "DATA_MISSING": {
        const cc = this.need(c, flag);
        const merged = { ...cc.hire, ...detail } as unknown as HireRecord;
        const still = missingFields(merged as WorkdayNewHireEvent);
        if (still.length > 0) throw new Error(`Still missing after decision: ${still.join(", ")}`);
        cc.hire = merged;
        cc.missingFields = [];
        this.planTasks(cc);
        break;
      }

      case "TASK_ESCALATED": {
        const taskId = flag.dedupeKey.slice("TASK_ESCALATED:".length);
        const task = this.store.state.tasks[taskId];
        if (!task) throw new Error(`Task ${taskId} not found`);
        if (outcome === "resolved_manually") {
          this.markTaskDone(task, actor, { manual: true });
        } else {
          task.status = "PENDING";
          task.attempts = 0;
          task.lastError = null;
        }
        break;
      }

      case "INTAKE_REVIEW": {
        if (outcome === "worker_type") {
          const caseId = detail["caseId"];
          const wt = detail["workerType"];
          if (typeof caseId !== "string" || !this.store.state.cases[caseId]) {
            throw new Error("worker_type decision requires detail.caseId of an existing case");
          }
          if (!isWorkerType(wt)) throw new Error("worker_type decision requires detail.workerType");
          this.store.state.cases[caseId].trackSources.email = wt;
        }
        break;
      }
    }

    flag.status = "DECIDED";
    flag.decision = { outcome, actor, at: this.nowIso(), detail };
    this.audit(actor, "flag.decided", flag.caseId, { flagId, type: flag.type, outcome }, { detail });
    if (c) this.refresh(c);
    this.store.save();
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  getCase(caseId: string): OnboardingCase {
    return this.requireCase(caseId);
  }

  tasksOf(caseId: string): Task[] {
    return Object.values(this.store.state.tasks).filter((t) => t.caseId === caseId);
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private requireCase(caseId: string): OnboardingCase {
    const c = this.store.state.cases[caseId];
    if (!c) throw new Error(`Unknown case ${caseId}`);
    return c;
  }

  private need(c: OnboardingCase | undefined, flag: Flag): OnboardingCase {
    if (!c) throw new Error(`Flag ${flag.id} is not linked to a case`);
    return c;
  }

  private taskOf(caseId: string, key: TaskKey): Task {
    const t = this.store.state.tasks[`${caseId}:${key}`];
    if (!t) throw new Error(`Task ${key} not found for case ${caseId}`);
    return t;
  }

  private setTaskStatus(caseId: string, key: TaskKey, status: Task["status"]): void {
    this.taskOf(caseId, key).status = status;
  }

  private markTaskDone(t: Task, actor: string, result: unknown): void {
    t.status = "DONE";
    t.completedBy = actor;
    t.result = result;
    t.lastError = null;
    this.audit(actor, "task.done", t.caseId, { taskId: t.id }, { result });
  }

  private depsDone(t: Task): boolean {
    return t.dependsOn.every((k) => this.store.state.tasks[`${t.caseId}:${k}`]?.status === "DONE");
  }

  /** Recomputes the case state from its tasks and closes it once day 14 has passed with all tasks done. */
  private refresh(c: OnboardingCase): void {
    if (c.state === "CLOSED") return;
    if (c.missingFields.length > 0) {
      c.state = "PLANNED";
      return;
    }
    const h = requireComplete(c);
    const tasks = this.tasksOf(c.id);
    const allDone = tasks.length > 0 && tasks.every((t) => t.status === "DONE");

    let state: CaseState;
    if (tasks.some((t) => t.status === "BLOCKED" || t.status === "FAILED")) state = "BLOCKED";
    else if (tasks.filter((t) => t.dueDate <= h.startDate).every((t) => t.status === "DONE")) state = "READY_DAY1";
    else if (tasks.some((t) => t.status === "DONE" || t.attempts > 0)) state = "IN_PROGRESS";
    else state = "PLANNED";
    c.state = state;

    if (allDone && this.today() >= addDays(h.startDate, CLOSE_AFTER_DAYS)) {
      c.state = "CLOSED";
      c.closedAt = this.nowIso();
    }
  }

  private raiseFlag(input: {
    caseId: string | null;
    type: FlagType;
    dedupeKey: string;
    rule: string;
    evidence: unknown;
  }): Flag {
    const open = Object.values(this.store.state.flags).find((f) => f.dedupeKey === input.dedupeKey && f.status === "OPEN");
    if (open) return open;
    const at = this.now();
    const flag: Flag = {
      id: randomUUID(),
      caseId: input.caseId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      rule: input.rule,
      evidence: input.evidence,
      options: OPTIONS[input.type],
      owner: this.owners[input.type],
      slaHours: SLA_HOURS[input.type],
      raisedAt: at.toISOString(),
      dueAt: new Date(at.getTime() + SLA_HOURS[input.type] * 3_600_000).toISOString(),
      status: "OPEN",
      decision: null,
    };
    this.store.state.flags[flag.id] = flag;
    this.audit(AGENT, "flag.raised", input.caseId, { type: input.type, dedupeKey: input.dedupeKey }, { flagId: flag.id, owner: flag.owner });
    return flag;
  }

  private autoResolve(dedupeKey: string, note: string): void {
    for (const f of Object.values(this.store.state.flags)) {
      if (f.dedupeKey !== dedupeKey || f.status !== "OPEN") continue;
      f.status = "AUTO_RESOLVED";
      f.decision = { outcome: "auto_resolved", actor: AGENT, at: this.nowIso(), detail: { note } };
      this.audit(AGENT, "flag.auto_resolved", f.caseId, { flagId: f.id, type: f.type }, { note });
    }
  }

  private audit(actor: string, action: string, caseId: string | null, input: unknown, output: unknown): void {
    this.store.appendAudit({ actor, action, caseId, input, output }, this.nowIso());
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private today(): string {
    return utcDate(this.now());
  }
}
