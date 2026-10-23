# Artifact 3: Capability Specification (HR Onboarding Coordination Agent)

Status: Draft for review. Structured from the source capability brief. Items marked TBD need a decision before build. Section 8 lists inconsistencies found in the source brief.

## 1. Purpose and scope

**Purpose.** Coordinate and manage new-hire onboarding for 220+ annual hires. The agent ingests multi-source payloads from four systems, tracks about 40 tasks across one week, automates routine execution (about 85%), and packages judgment calls (about 15%) for HR Ops. Target: 100% SLA compliance with nothing falling through the cracks. The solution runs with zero on-premise AI infrastructure.

**In scope**

- Multi-channel intake normalisation (Workday, ServiceNow, LMS, email)
- Identity resolution
- Task orchestration (about 40 tasks over one week)
- Duplicate filtering
- Standard task execution
- Judgment-call packaging for HR Ops

**Out of scope**

- Core HR policy design
- Software license changes
- Payroll execution
- I-9 hold authorisation (HL)
- Manager performance management
- Notification dispatch (handled by plain automation)

## 2. Inputs and outputs

**Inputs**

| Source | Form | Notes |
|---|---|---|
| Workday (Core HR) | JSON webhook | Primary system of record for workers |
| ServiceNow | Webhook | IT provisioning requests |
| LMS | Webhook | Compliance training events |
| Email and forms | Unstructured text | Coverage for payloads outside the three webhooks |

**Outputs**

- Updated enterprise records in Workday, ServiceNow and LMS
- HR Ops escalation queue payloads
- State-transition events

**Operational targets**

| Target | Value |
|---|---|
| Intake to normalisation latency | Under 30 seconds |
| Malformed extraction alert | Above 2% of payloads per day |
| Enterprise API write recovery | Queued writes drain FIFO on recovery |
| Webhook burst protection | Above 50 alerts per minute triggers intake protection (behaviour TBD) |

## 3. Entity and state model

### 3.1 `NewHireRecord`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `source` | enum | `WORKDAY`, `SERVICENOW`, `LMS`, `EMAIL` |
| `candidate_id` | string, nullable | Null until identified |
| `onboarding_status` | enum | See 3.2 |
| `flags[]` | string array | For example `NOTES_TRUNCATED`, `LLM_FALLBACK_USED`, `IDENT_FUZZY`, `BUDDY_SENIORITY_REVIEW`, `I9_COMPLIANCE_HOLD` |
| `timestamps` | object | Per-stage timestamps (see M5) |
| `sla_deadline` | timestamp | Basis for the deadline is TBD (see 8) |

### 3.2 Status enum and transitions

Happy path:

`RECEIVED` → `NORMALISED` → `IDENTIFIED` → `TASKS_INITIALISED` → `IN_PROGRESS` → `COMPLETED` (terminal)

Exception states:

- `ESCALATED`: routed to HR Ops
- `QUARANTINED`: three failed normalisations
- `IDENT_FAILED`: identity could not be resolved safely (see 8, not yet in the enum)
- `UNCLASSIFIED`: candidate details could not be extracted (see 8, not yet in the enum)

Every transition writes one audit row: `{record_id, from, to, actor, reason, timestamp}`.

## 4. Core decision logic

### D-1 Normalisation (cloud LLM API with fallback)

1. Send unstructured text and email payloads to the enterprise cloud LLM API. Request a structured JSON output that matches a fixed schema.
2. If the call fails, times out, or returns a malformed schema, run the regex keyword parser and tag the record `LLM_FALLBACK_USED`.
3. If the regex parser cannot extract candidate details, set the record to `UNCLASSIFIED` and escalate.
4. If notes exceed 2,000 characters, truncate them, flag `NOTES_TRUNCATED`, and continue. Intake never fails on length.
5. After three failed normalisations, set the record to `QUARANTINED`.

LLM timeout value is TBD.

### D-2 Identification

- Exact match on candidate email or ID in the Workday directory proceeds.
- Fuzzy match with score of 0.95 or higher proceeds with flag `IDENT_FUZZY`.
- Score below 0.95, or more than one candidate, sets `IDENT_FAILED` and escalates.
- The agent never guesses an identity.

### D-3 Duplicate detection

- A payload is a duplicate candidate when candidate ID and task type match an open task created less than 72 hours ago.
- Auto-merge only when the system event is identical and no exception flags are set.

### D-4 Standard task automation (about 40 tasks)

Generated automatically over one week:

- IT provisioning
- Benefits enrolment
- Compliance training assignment
- Buddy matching
- Welcome materials
- 30-day checkpoint scheduling
- Manager handoff

**Buddy matching.** Match a peer by department and location. The mentor must have at least one year of tenure. If seniority is ambiguous, flag `BUDDY_SENIORITY_REVIEW`.

### D-5 Compliance and I-9 verification

- I-9 verification must finish within the statutory window. The brief sets a Day 3 requirement with a Day 2 check.
- If documentation is missing at Day 2, then:
  - flag `I9_COMPLIANCE_HOLD`
  - open a high-priority HR Ops ticket with a 4-hour SLA clock
  - flag the candidate profile in Workday as `PENDING_COMPLIANCE`
- The agent does not authorise the hold itself. That step is out of scope (see 1).

## 5. Integration contracts

| System | Endpoint | Auth | Timeout | Retries | Other |
|---|---|---|---|---|---|
| Cloud LLM gateway | HTTPS REST to Azure OpenAI, AWS Bedrock or Anthropic Enterprise (vendor TBD) | API key from enterprise secrets manager | TBD | TBD | Zero data retention clause; no training on company data |
| Workday | `POST /api/v3/workers` | OAuth2 | 8s | 3 | Idempotency key `source_report_id`; rate limit 60 req/min |
| ServiceNow | `POST /api/v2/table/task` | OAuth2 | 8s | 3 | None |
| LMS | `POST /api/v1/enrollments` | API key | 10s | 2 | None |

## 6. AI security layer

- **Data handling.** Candidate PII is sent to the LLM gateway in normalisation payloads. Confirm the zero-retention clause and data processing agreement before go-live.
- **Secrets.** All API keys live in the enterprise secrets manager. None are stored in code or logs.
- **Output validation.** Every LLM response must pass schema validation before any write. A failed check triggers the D-1 fallback.
- **Fallback safety.** The regex parser never writes an identity. It can only feed D-2, which requires an exact or high-confidence match.

## 7. Telemetry contracts (M1 to M5)

**M1: Compliance and SLA tracking**

- The state machine records exact timestamps when I-9 and LMS training tasks are triggered and when they complete or escalate.
- `audit_log_trail` computes `sla_delta_hours = completion_timestamp - trigger_timestamp`.
- Any delta over the statutory threshold sets `SLA_BREACH`. Threshold values are TBD.

**M2: Judgment error and override telemetry**

- Every HITL exception resolution (Category 5) records the human actor ID and a required root-cause tag: `AGENT_MISS`, `MANAGER_ERROR` or `DATA_SOURCE_LAG`.
- Table `escalation_resolution_table` holds `override_flag` (boolean) and `root_cause_tag` (enum).

**M3: Administrative hours reduction**

- `system_execution_log` records `automated_duration_seconds` for Categories 1 to 4 (the 36 automated tasks).
- Labour hours saved equal the benchmark manual time (about 150 hours baseline) minus automated execution time.

**M4: Orphaned task and drop-off**

- A background health check runs every 30 minutes.
- It finds records in `IN_PROGRESS` with no active timer for more than 4 hours.
- Each stalled record increments `orphaned_task_counter` and triggers a PagerDuty alert.
- Target: 0% unflagged drop-offs.

**M5: Task completion latency**

- Ingestion and the workflow engine record end-to-end timestamps per hire record.
- `new_hire_records` stores `total_onboarding_duration_days`.
- A dashboard query measures the share of hires completed within the one-week target. Target: 100%.

## 8. Open items and inconsistencies

These need a decision before build. Each one changes behaviour or reporting.

1. **Undefined states.** `IDENT_FAILED` and `UNCLASSIFIED` appear in the logic but not in the status enum. Add them, or map them to `ESCALATED` with a reason code.
2. **Task count.** The brief says about 40 tasks, but M3 counts 36 automated tasks in Categories 1 to 4. Confirm the exact task inventory and category mapping.
3. **Category 5.** M2 refers to Category 5 (HITL exceptions), but no category list is defined in the brief.
4. **Statutory thresholds.** M1 flags breaches against statutory thresholds, but no numbers are given. Confirm the I-9 and training deadlines with HR and legal.
5. **I-9 hold ownership.** I-9 hold authorisation is out of scope, yet D-5 sets `I9_COMPLIANCE_HOLD` and a Workday status. Confirm who owns the hold decision.
6. **SLA basis.** `sla_deadline` has no defined start point. Define whether it counts from Workday hire date, start date or payload receipt.
7. **Burst protection.** The 50-alerts-per-minute threshold has no defined behaviour (queue, reject, or pause intake).
8. **LLM timeout and retries.** Not specified for the cloud LLM gateway, though D-1 depends on it and the 30-second latency target applies.
9. **Workday rate limit.** The 60 requests per minute limit may not fit a burst of 220 hires on one day. Model the peak load.
10. **Vendor choice.** The gateway could be Azure OpenAI, AWS Bedrock or Anthropic Enterprise. The choice affects the data processing terms in section 6.
