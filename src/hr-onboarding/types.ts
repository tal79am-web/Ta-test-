// Shared domain types for the HR onboarding agent. See docs/hr-onboarding/SPEC.md.

export type CaseState = "PLANNED" | "IN_PROGRESS" | "BLOCKED" | "READY_DAY1" | "CLOSED";
export type WorkerType = "employee" | "contractor";
export type TaskStatus = "PENDING" | "DONE" | "BLOCKED" | "FAILED";
export type FlagStatus = "OPEN" | "DECIDED" | "AUTO_RESOLVED";

export type FlagType =
  | "DATA_MISSING"
  | "TRACK_AMBIGUOUS"
  | "BUDDY_CONFIRM"
  | "BUDDY_SENIORITY"
  | "BUDDY_NO_MATCH"
  | "I9_LATE"
  | "TASK_ESCALATED"
  | "INTAKE_REVIEW";

export type TaskKey =
  | "it_request"
  | "welcome_email"
  | "track_assign"
  | "buddy_proposal"
  | "checkpoint_30d"
  | "benefits_reminder"
  | "handoff_pack";

/** Payload of a Workday new-hire or rehire event (R1). Optional fields are validated on intake. */
export interface WorkdayNewHireEvent {
  eventType: "new_hire" | "rehire";
  workerId: string;
  workerType?: string;
  offerWorkerType?: string;
  startDate?: string;
  location?: string;
  site?: string;
  team?: string;
  roleFamily?: string;
  jobLevel?: number;
  managerId?: string;
}

export type HireRecord = WorkdayNewHireEvent;

/** A hire record once every required field has been supplied. */
export type CompleteHire = WorkdayNewHireEvent & {
  workerType: string;
  offerWorkerType: string;
  startDate: string;
  location: string;
  site: string;
  team: string;
  roleFamily: string;
  jobLevel: number;
  managerId: string;
};

/** Worker-type values from each source compared by the R3 gate. */
export interface TrackSourceRecord {
  workday?: string;
  offer?: string;
  email?: string;
  linked?: { workerId: string; workerType: string }[];
}

export interface BuddyProposalRecord {
  workerId: string;
  score: number;
  levelGap: number;
  rationale: string;
}

export interface BuddyState {
  proposals: BuddyProposalRecord[];
  seniorityCrossed: boolean;
  confirmedWorkerId: string | null;
  confirmedBy: string | null;
  rejected: boolean;
}

export interface OnboardingCase {
  id: string;
  key: string;
  state: CaseState;
  templateVersion: string;
  hire: HireRecord;
  missingFields: string[];
  trackSources: TrackSourceRecord;
  track: WorkerType | null;
  i9: { section1Done: boolean; section2Done: boolean };
  i9Alerts: string[];
  buddy: BuddyState | null;
  createdAt: string;
  closedAt: string | null;
}

export interface Task {
  id: string;
  caseId: string;
  key: TaskKey;
  system: string;
  owner: string;
  dueDate: string;
  dependsOn: TaskKey[];
  status: TaskStatus;
  attempts: number;
  lastError: string | null;
  result: unknown;
  completedBy: string | null;
}

export interface Decision {
  outcome: string;
  actor: string;
  at: string;
  detail: unknown;
}

export interface Flag {
  id: string;
  caseId: string | null;
  type: FlagType;
  dedupeKey: string;
  rule: string;
  evidence: unknown;
  options: string[];
  owner: string;
  slaHours: number;
  raisedAt: string;
  dueAt: string;
  status: FlagStatus;
  decision: Decision | null;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  caseId: string | null;
  input: unknown;
  output: unknown;
}

export interface StoreState {
  cases: Record<string, OnboardingCase>;
  tasks: Record<string, Task>;
  flags: Record<string, Flag>;
  audit: AuditEntry[];
  idempotency: Record<string, unknown>;
}
