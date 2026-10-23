# Scenario 01: HR Onboarding Coordination, Agentic Solution

23 Oct 2026 · @Tal

The agent runs the deterministic 85% of onboarding and detects the 15% of judgment calls, routing each to a named human with evidence. It never makes them.

## 1. Problem statement and metrics

Three HR Ops staff hand-coordinate about 8,800 onboarding tasks a year across six systems. Roughly 1,320 of those tasks need judgment, and missed edge cases create compliance and day-one risk.

### The arithmetic

- 220 hires × ~40 tasks = ~8,800 tasks a year, or ~2,900 per HR Ops person.
- ~15% need judgment, which is ~1,320 judgment calls a year (~6 per hire). The other ~7,500 are deterministic paperwork.
- 220 hires a year is ~4.2 starts a week. With a 2-week window, ~8–9 onboardings run at once, or ~340 open tasks at any moment.

### Problem statement

HR Ops spends most of its time moving deterministic tasks between Workday, ServiceNow, the LMS and email. The ~6 judgment calls per hire look different every time, which is why rules-based automation failed. The main examples are contractor versus employee compliance track, buddy seniority norms, and late I-9 holds. When a judgment call is missed, the cost is a compliance exposure or a new hire who is not ready on day one.

### The design answer

The agent detects judgment calls; it never makes them. It executes the deterministic ~85% and routes each flagged case to a named human, with the evidence attached.

### Metrics

| Metric | Baseline | Target (proposed) | How measured |
| :--- | :--- | :--- | :--- |
| **HR Ops touches per hire** | Unknown, measure for 4 weeks | ≤ 6 (the judgment calls only) | Audit log: human actions per case |
| **Deterministic tasks run without a human** | ~0% | ≥ 95% of ~34 per hire | Task log by actor |
| **Judgment-flag recall** | n/a | ≥ 98% on the labelled eval set | Eval suite (section 4) |
| **False-flag rate** | n/a | ≤ 15% of flags | Human dismissals ÷ flags raised |
| **I-9 deadlines met** | Unknown | 100%; zero missed Section 2 deadlines | I-9 monitor log |
| **Day-1 readiness** (laptop, access, training assigned) | Unknown | ≥ 98% of starts | Checklist status at start date |
| **Tasks overdue at day 14** | Unknown | ≤ 1% | Case state at close |
| **Incidents where something "fell through the cracks"** | Unknown, no log exists | −80% against the measured baseline | Incident tag in case record |

The baselines are not yet known. The first deliverable is a 4-week measurement of the current process, which also prices what "falls through the cracks" costs today (see section 5).

## 2. Delegation analysis

Five of the nine task families can run fully agentic, three run agent-led with human oversight, and I-9 hold decisions stay human-led. The deciding test is the same each time: is the outcome reversible, and is the rule fully specified?

### Task family delegation

| Task family | Delegation | Agent does | Human does | Why |
| :--- | :--- | :--- | :--- | :--- |
| **IT provisioning (ServiceNow)** | Fully agentic | Creates requests from a role-based template; tracks them to completion; chases overdue ones | Nothing, unless a request is rejected | Fixed role-to-access rules; reversible; ServiceNow already approves access |
| **Welcome materials** | Fully agentic | Sends approved templates filled from Workday fields | Owns the templates | Low risk; content is pre-approved |
| **30-day checkpoint scheduling** | Fully agentic | Books the hire, manager and HR from calendar availability | Nothing | Deterministic and easy to reschedule |
| **Benefits enrolment** | Fully agentic (reminders only) | Sends the enrolment link, reminds before the window closes, confirms completion | The employee makes all choices; HR handles queries | Choices are personal and regulated, so the agent only nudges |
| **Task chasing and status** | Fully agentic | Tracks all ~40 tasks per case, escalates overdue ones, reports status | Reviews the daily exceptions digest | This is the coordination work that consumes HR Ops today |
| **Compliance training track** | Agent-led with oversight | Assigns the track automatically when worker type is unambiguous and consistent across sources; otherwise raises `TRACK_AMBIGUOUS` | Decides the track for flagged cases | The wrong track is a compliance gap; worker classification has legal weight |
| **Buddy matching** | Agent-led with oversight | Proposes the top 3 by rules (same site, different team, tenure, capacity); flags `BUDDY_SENIORITY` if norms are crossed | Approves seniority-crossing matches | The norms are cultural and partly unwritten |
| **Manager handoff** | Agent-led with oversight | Drafts the handoff pack (status, open items, flags resolved) | Manager confirms receipt; HR signs off on close | The handoff carries accountability and needs a named owner |
| **I-9 late and hold decision** | Human-led | Tracks deadlines; alerts one business day before; raises `I9_LATE` on breach with the evidence | Decides whether to place or release a hold | Legal weight; an employment action must have a human decision-maker |

### Detect or make?

The agent detects. Every judgment call becomes a typed flag carrying the case, the rule that triggered it, the evidence, the options and an SLA. A named human decides. Each decision is logged and added to the eval set, so detection improves without the agent ever acquiring decision rights.

## 3. Capability specification

The solution is a deterministic workflow (Level 1) with LLM calls at only three points: email intake, buddy-match rationales, and handoff drafting. Flag detection itself is rule-based. Ten requirements define it, each precise enough for a coding agent to start building.

**Architecture in one line:** Workday event → case created → rules engine builds the task plan → orchestrator executes tasks through namespaced tools → flags go to a human queue → case closes at day 14 with an audit trail.

### Requirements

| ID | Requirement | Input | Output | Acceptance check |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | **Case creation.** On a Workday new-hire or rehire event, create one Onboarding Case. Idempotent on Workday worker ID plus start date. | Workday event: worker ID, worker type, start date, location, job level, manager ID | OnboardingCase record, state = PLANNED | Replaying the same event creates no duplicate; all required fields are present or the case is flagged `DATA_MISSING` |
| **R2** | **Task plan generation.** Build the task plan from a versioned template keyed on worker type × location × role family. Deterministic code; no LLM. | OnboardingCase | ~40 Task records with owner, due date, dependencies and source system | The same input always yields the same plan; the template version is stored on the case |
| **R3** | **Worker-type consistency gate.** Before any compliance track is assigned, compare worker type across Workday, the offer data and the intake email. Any mismatch or missing value raises `TRACK_AMBIGUOUS` and blocks the compliance task. | Worker-type values from each source | Track assignment or a flag | No track is assigned while sources conflict; tested by the boundary scenario in section 4 |
| **R4** | **Email intake extraction.** An LLM classifies each inbound HR inbox email and extracts fields into a fixed schema. It never triggers actions directly. | Email body, sender, thread | `{case_id, intent, fields{}, confidence, evidence_quote}` validated against the schema | If confidence < 0.8 or no case matches, the email goes to the human queue. Schema-invalid output is retried once, then queued |
| **R5** | **Namespaced tools.** All side effects go through these tools only: `workday_get_worker`, `servicenow_create_request`, `servicenow_get_status`, `lms_assign_course`, `lms_get_completion`, `calendar_schedule`, `email_send_template`. Each is idempotent with a request key. | Typed parameters | Concise result plus status; actionable error text | Each tool call is logged; a retried call never creates a duplicate ticket, course or invite |
| **R6** | **I-9 deadline monitor.** A deterministic timer tracks Section 1 (by the first day of work) and Section 2 (within 3 business days of start). It alerts HR one business day before each deadline. On a breach it raises `I9_LATE`. | Start date, I-9 status, business calendar | Alerts and a flag | The agent has no tool that places or releases a hold. A breach always produces a flag within 1 hour |
| **R7** | **Buddy proposal.** Score candidates on same site, different team, tenure ≥ 6 months, and current buddy load ≤ 1. Return the top 3. If the level gap exceeds the configured norm, raise `BUDDY_SENIORITY`. | Hire profile, employee directory | Ranked list with reasons, or a flag | Uses only the configured rules; every proposal includes its rationale |
| **R8** | **Judgment-flag queue.** Each flag carries type, case, triggering rule, evidence, options, recommended owner and an SLA (24 business hours; 4 for `I9_LATE`). The human decision is captured as structured data. | Flags from R1–R7 | Decision record that resumes the blocked task | No blocked task resumes without a logged human decision; decisions are exported to the eval set |
| **R9** | **State, retries and audit.** Persist the case state machine (`PLANNED` → `IN_PROGRESS` → `BLOCKED` → `READY_DAY1` → `CLOSED`) externally. Cap retries at 3 with backoff, then escalate. Log every action with its actor, inputs and outputs. | All events | Resumable case state; append-only audit log | A process restart resumes in-flight cases without data loss; no task retries more than 3 times |
| **R10** | **Status and metrics.** Send a daily exceptions digest to HR Ops (flags, overdue tasks, day-1 risks). Provide a dashboard of the section 1 metrics. | Case and task data | Digest plus dashboard | The digest lists only items needing action; all section 1 metrics are computable from logs |

- **Out of scope for v1:** benefits decisions, I-9 document verification, and any change to Workday master data.
- **Model use:** one hosted model via an enterprise agreement, called only in R4 and for drafting R7 rationales and handoff packs. No employee PII is sent beyond the fields each call needs.

## 4. Validation design

Five scenarios gate the release: a happy path, an edge case, a failure mode, and two boundary tests that prove the agent detects judgment calls but never makes them. All checks are binary pass/fail and run against sandboxed copies of Workday, ServiceNow and the LMS.

### Validation scenarios

| # | Type | Setup | Expected behaviour | Pass criteria |
| :--- | :--- | :--- | :--- | :--- |
| **V1** | Happy path | A full-time US-based employee, standard role. All sources agree. The I-9 is completed on time. | The full ~40-task plan executes. IT request, training track, buddy proposal, welcome email and 30-day checkpoint are all created. The case closes at day 14. | Zero human touches except the buddy confirmation. Every task closes on time. Re-running the event creates no duplicates. |
| **V2** | Edge case | A rehired former contractor, now joining as an employee. Workday holds two worker records, and the prior LMS completions are on the contractor track. | Matches on the new worker ID. Does not reuse the contractor training history. Raises `TRACK_AMBIGUOUS` if any source still shows contractor. | No compliance track is assigned until a human decides. The flag cites both records as evidence. |
| **V3** | Failure mode | The ServiceNow API returns 503 for 6 hours on the day before the start date. | Retries 3 times with backoff, then escalates. Marks the case at day-1 risk. Includes it in the digest. Resumes automatically when the service recovers. | No duplicate IT requests. The escalation reaches HR within 1 hour of the final retry. The case state survives a process restart. |
| **V4** | Boundary test | Day 3 after start; I-9 Section 2 is not completed. The email thread includes the manager writing "just put them on hold". | Raises `I9_LATE` with deadline, status and the email as evidence. Does not act on the manager's instruction. | No hold is placed or released by the agent. The flag is raised within 1 hour, routed to the named HR owner, with a 4-hour SLA. |
| **V5** | Boundary test | A buddy proposal where the best rule-based match is three levels senior to the hire. | Raises `BUDDY_SENIORITY` with the top 3 candidates and their rationale. | The match is not confirmed without human approval. |

- **Regression suite:** Build at least 60 labelled cases before go-live: 40 replayed from last year's hires and 20 synthetic edge cases. Each case is labelled with whether a flag is expected. Gate thresholds are flag recall ≥ 98%, false-flag rate ≤ 15%, and email-extraction field accuracy ≥ 95%. Every human flag decision in production is added to the suite weekly.

## 5. Assumptions and unknowns

Nine genuine unknowns must be resolved in discovery before the build starts. The first two decide whether the design holds at all.

| # | Area | Unknown | Why it matters | How to resolve | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **U1** | Organisation | Who has the authority to decide contractor versus employee track, and is there a written policy? | Without a named owner, `TRACK_AMBIGUOUS` flags have nowhere to go | Interview the HR Ops lead and Legal; document a decision matrix | HR Ops lead |
| **U2** | Data | How reliable is worker type in Workday, and how often does it conflict with offer data? | Sets the R3 flag volume. Frequent conflicts could swamp the queue | Sample last year's 220 hires and count conflicts | HR Ops + Workday admin |
| **U3** | Systems | The scenario names 4 sources (Workday, ServiceNow, LMS, email), but tasks come from 6 systems. What are the other 2? | Each needs a tool, access rights and test coverage | System inventory session | HR Ops lead |
| **U4** | Systems | Are API access and integration users available for Workday, ServiceNow and the LMS? | Without write access, the agent can only recommend, not execute | IT and vendor licence review | IT |
| **U5** | Organisation | With no AI infrastructure today, what do security, procurement and data protection require before employee PII reaches a hosted model? | Could gate the timeline by months | Early security and privacy review | CISO / DPO |
| **U6** | Data | What does "falls through the cracks" cost today? No incident log exists. | No baseline means ROI cannot be proven | 4-week baseline log plus a review of last year's missed I-9s and day-1 failures | HR Ops |
| **U7** | Organisation | Are buddy seniority norms written down, or tacit? | Tacit norms cannot be encoded in R7 | Interview managers; codify the level-gap rule | HR Ops lead |
| **U8** | Data | What share of the ~40 tasks start in email, and how structured are those emails? | Sizes the LLM intake work and its error risk | Mailbox sample of 200 messages | HR Ops |
| **U9** | Organisation | Who decides I-9 holds, how are remote hires verified, and is E-Verify used? | Defines the `I9_LATE` routing and evidence | Session with Legal / HR compliance | Legal |

### Working assumptions (to confirm)

- All hires subject to I-9 are US-based. Non-US hires follow a separate right-to-work process, out of scope for v1.
- Hiring volume is roughly even. Seasonal peaks above ~8 starts a week have not been modelled.
- The ~15% judgment share is spread across hires rather than concentrated in a few roles or locations.
- HR Ops capacity freed is redeployed, not cut. Adoption depends on the team trusting the flag queue.
