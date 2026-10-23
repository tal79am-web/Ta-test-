# HR Onboarding Agent: Build Plan

Source: `SPEC.md` in this folder. Requirement IDs (R1–R10), validation IDs (V1–V5) and unknown IDs (U1–U9) refer to that document.

## Guiding rules

- Build the deterministic core first. The LLM is added last, behind schema validation.
- Every side effect goes through an R5 tool with an idempotency key. No module writes to a source system directly.
- Nothing goes live in a source system until discovery has resolved U3 and U4.
- Each phase ends with a demo against sandbox systems and a passing subset of the validation suite.

## Phases

### Phase 0: Discovery (before any build)

Owned by HR Ops and IT, with Legal and the CISO / DPO involved.

- Resolve U1 (track decision owner) and U7 (buddy norms). Both block the rules engine.
- Resolve U3 and U4: confirm the six systems, and confirm sandbox API access for each.
- Start U5 early. Privacy and security review may gate the timeline by months.
- Run the 4-week baseline log (U6) in parallel. Nothing depends on it except the ROI case.
- Sample last year's 220 hires for U2 (worker-type conflicts) and U8 (email share).

**Exit gate:** named owners for every flag type, sandbox access for every system, and a signed-off decision matrix for compliance track.

### Phase 1: Foundation (R1, R9)

Persistence and audit come before any business logic, so every later step is logged from the start.

- Case store with the state machine PLANNED → IN_PROGRESS → BLOCKED → READY_DAY1 → CLOSED.
- Append-only audit log: actor, inputs, outputs, timestamp.
- Idempotent case creation keyed on worker ID plus start date.
- Retry wrapper: cap at 3, exponential backoff, escalate on final failure.
- Restart test: kill the process mid-case and confirm it resumes without data loss.

**Validation:** part of V3 (state survives restart); R1 replay test.

### Phase 2: Rules core (R2, R3, R6)

Deterministic code with no LLM.

- Versioned task-plan templates keyed on worker type × location × role family. Store the template version on the case.
- Worker-type consistency gate. Any mismatch or missing value raises `TRACK_AMBIGUOUS` and blocks the compliance task.
- I-9 deadline timer using the business calendar. Alert one business day before each deadline. Raise `I9_LATE` on breach within 1 hour.
- Confirm the I-9 module has no path to a hold-placing tool.

**Validation:** V2 (contractor edge case), V4 (I-9 boundary, once the flag exists in Phase 4).

### Phase 3: Namespaced tools (R5)

One adapter per source system. Adapters follow the existing connector pattern in `src/connectors/`, one file per system.

- Read tools first: `workday_get_worker`, `servicenow_get_status`, `lms_get_completion`.
- Write tools next, each with a request key: `servicenow_create_request`, `lms_assign_course`, `calendar_schedule`, `email_send_template`.
- Structured results with actionable error text, so the orchestrator can reason about failures.
- Tool-call logging through the Phase 1 audit log.
- Contract tests against each sandbox.

**Validation:** V1 (happy path, duplicate-free re-run), V3 (503 handling).

### Phase 4: Judgment-flag queue and reporting (R8, R10)

- Flag record: type, case, triggering rule, evidence, options, recommended owner, SLA (24 business hours; 4 for `I9_LATE`).
- Decision capture as structured data. A blocked task resumes only after a logged decision.
- Decisions export to the eval set.
- Daily exceptions digest listing only items that need action.
- Dashboard for the section 1 metrics, computed from logs.

**Validation:** V4 and V5 pass criteria, plus the rule that no blocked task resumes without a decision.

### Phase 5: LLM-assisted steps (R4, R7 rationale, handoff drafts)

Added last, so the system works without them.

- R4 email intake: model output must validate against the schema. Confidence below 0.8 or no case match goes to the human queue. One retry on schema failure, then queue.
- R7 buddy rationales and manager handoff drafts. Both are text generated from fields already in the case.
- Limit each model call to the fields it needs. No employee PII beyond that.

**Validation:** field accuracy ≥ 95% on the email subset of the regression suite.

### Phase 6: Validation and gates

- Build the regression suite: 40 cases from last year's hires, 20 synthetic edge cases, minimum 60 total. Label each with whether a flag is expected.
- Run V1 to V5 against sandboxes.
- Enforce the gates: flag recall ≥ 98%, false-flag rate ≤ 15%, email field accuracy ≥ 95%.

**Validation:** all five scenarios pass and all three gates pass.

### Phase 7: Shadow run, then pilot

- Shadow mode: the agent plans and flags, but humans run the process. Compare outputs for at least one full hiring cycle.
- Pilot: a single location or role family goes live, with the daily digest reviewed by HR Ops.
- Scale only when the Section 1 metrics are met for the pilot cohort.

## Ticket list

Sizes are relative (S, M, L). Dependencies are ticket IDs.

| ID | Ticket | Req | Size | Depends on |
| :--- | :--- | :--- | :--- | :--- |
| E-01 | Case store and state machine | R9 | M | Discovery exit |
| E-02 | Append-only audit log | R9 | S | E-01 |
| E-03 | Idempotent case creation from Workday event | R1 | S | E-01 |
| E-04 | Retry wrapper (cap 3, backoff, escalate) | R9 | S | E-02 |
| E-05 | Versioned task-plan templates and plan builder | R2 | L | E-03, U1 |
| E-06 | Worker-type consistency gate | R3 | M | E-03, U1, U2 |
| E-07 | I-9 deadline timer and business calendar | R6 | M | E-03, U9 |
| E-08 | Read tools: Workday, ServiceNow status, LMS completion | R5 | M | U3, U4 |
| E-09 | Write tools with request keys | R5 | L | E-08, E-02 |
| E-10 | Buddy scoring with configured rules | R7 | M | U7 |
| E-11 | Flag record, routing and SLA clock | R8 | M | E-02 |
| E-12 | Decision capture and resume logic | R8 | M | E-11 |
| E-13 | Daily exceptions digest | R10 | S | E-11 |
| E-14 | Metrics dashboard from logs | R10 | M | E-02, E-11 |
| E-15 | Email intake extraction with schema validation | R4 | L | E-11, U8 |
| E-16 | Handoff pack drafting | R7, handoff | S | E-05 |
| E-17 | Regression suite (60+ cases) | Section 4 | L | E-11, U6 |
| E-18 | Scenario tests V1 to V5 in sandbox | Section 4 | L | E-09, E-11 |
| E-19 | Shadow-run comparison report | Phase 7 | M | E-18 |

## Open decisions for the team

- **Hosting of the new service.** The current repository is an ERP MCP server. The onboarding agent is a separate workload with its own connectors. Decide whether it lives in this repository, in a new one, or alongside it in a monorepo.
- **Tool surface.** The R5 tools could be exposed as MCP tools, matching this repository's pattern, or called directly by the orchestrator. Pick one before E-08.
- **Persistence.** The spec requires external state. Choose the store before E-01.
