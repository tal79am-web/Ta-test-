# Artifact 3: Capability Specification (HR Onboarding Coordination Agent)

Status: Draft, revision 2. Structured from the source capability brief. Items marked TBD need a decision before build. Section 8 lists open items.

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
- Software licence changes
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
| Enterprise API write recovery | Queued writes drain FIFO on recovery (D-7) |
| Webhook burst protection | Above 50 alerts per minute triggers intake protection (D-7) |

## 3. Entity and state model

### 3.1 `NewHireRecord`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `source` | enum | `WORKDAY`, `SERVICENOW`, `LMS`, `EMAIL` |
| `candidate_id` | string, nullable | Null until identified |
| `worker_type` | enum | `EMPLOYEE`, `CONTRACTOR`, or null if the source omits it (see D-6) |
| `onboarding_status` | enum | See 3.2 |
| `flags[]` | string array | See 3.3 |
| `timestamps` | object | Per-stage timestamps (see M5) |
| `sla_deadline` | timestamp | Start point is TBD (see 8) |

### 3.2 Status enum and transitions

Happy path:

`RECEIVED` → `NORMALISED` → `IDENTIFIED` → `TASKS_INITIALISED` → `IN_PROGRESS` → `COMPLETED` (terminal)

Exception states. Each one routes the record to the HR Ops queue unless noted.

| State | Meaning | Source |
|---|---|---|
| `ESCALATED` | Routed to HR Ops for a judgment call | D-1, D-2, D-5, D-6 |
| `IDENT_FAILED` | Identity cannot be resolved safely (no match, low score, or several candidates) | D-2 |
| `IDENT_UNVERIFIED` | Identity cannot be checked because a source API is unavailable. Retried by the probe in D-7. | D-7 |
| `UNCLASSIFIED` | Candidate details cannot be extracted from the payload | D-1 |
| `QUARANTINED` | Three failed normalisations. Not retried automatically. | D-1 |
| `PENDING_DECISION` | The first of two concurrent requests for one candidate. Holds the identity lock. | D-3 |
| `DUPLICATE_HELD` | A duplicate that cannot be auto-merged. Not processed until HR Ops decides. | D-3 |

Every transition writes one audit row: `{record_id, from, to, actor, reason, timestamp}`.

### 3.3 Flag registry

| Flag | Set by | Meaning |
|---|---|---|
| `LLM_FALLBACK_USED` | D-1 | Regex parser produced the result, not the LLM |
| `NOTES_TRUNCATED` | D-1 | Notes were cut at 2,000 characters |
| `IDENT_FUZZY` | D-2 | Identity matched at score 0.95 or higher, not exactly |
| `BUDDY_SENIORITY_REVIEW` | D-4 | Mentor seniority is ambiguous |
| `I9_COMPLIANCE_HOLD` | D-5 | I-9 documentation missing at Day 2 |
| `CONTRACTOR_TRACK_AMBIGUITY` | D-6 | Contractor compliance track cannot be set safely |
| `FLAG_PENDING` | D-7 | Urgent item held during an enterprise API outage |
| `SLA_BREACH` | M1 | A compliance task exceeded its statutory threshold |

The Workday profile status `PENDING_COMPLIANCE` is written by D-5. It is not a record flag.

## 4. Core decision logic

### D-1 Normalisation (cloud LLM API with fallback)

1. Send unstructured text and email payloads to the enterprise cloud LLM API. Request a structured JSON output that matches a fixed schema.
2. If the call fails, times out, or returns a malformed schema, run the regex keyword parser and set `LLM_FALLBACK_USED`.
3. If the regex parser cannot extract candidate details, set the record to `UNCLASSIFIED` and escalate.
4. If notes exceed 2,000 characters, truncate them, set `NOTES_TRUNCATED`, and continue. Intake never fails on length.
5. After three failed normalisations, set the record to `QUARANTINED`.
6. Any LLM output outside the schema enum is rejected and handled as in step 2.

LLM timeout value is TBD (see 8).

### D-2 Identification

- Exact match on candidate email or ID in the Workday directory proceeds.
- Fuzzy match with score of 0.95 or higher proceeds with `IDENT_FUZZY`.
- Score below 0.95, or more than one candidate, sets `IDENT_FAILED` and escalates.
- The agent never guesses an identity.

### D-3 Duplicate detection and concurrency

- A payload is a duplicate candidate when candidate ID and task type match an open task created less than 72 hours ago.
- Auto-merge only when the system event is identical and no exception flags are set.
- A duplicate that does not meet the auto-merge rule moves to `DUPLICATE_HELD` for HR Ops.
- Concurrent requests for one candidate use an atomic distributed lock. The first request acquires the lock and moves to `PENDING_DECISION`. The second moves to `DUPLICATE_HELD`.

### D-4 Standard task automation (about 40 tasks)

Generated automatically over one week:

- IT provisioning
- Benefits enrolment
- Compliance training assignment
- Buddy matching
- Welcome materials
- 30-day checkpoint scheduling
- Manager handoff

**Buddy matching.** Match a peer by department and location. The mentor must have at least one year of tenure. If seniority is ambiguous, set `BUDDY_SENIORITY_REVIEW`.

### D-5 Compliance and I-9 verification

- I-9 verification must finish within the statutory window. The brief sets a Day 3 requirement with a Day 2 check.
- If documentation is missing at Day 2, then:
  - set `I9_COMPLIANCE_HOLD`
  - open a high-priority HR Ops ticket with a 4-hour SLA clock
  - set the candidate profile in Workday to `PENDING_COMPLIANCE`
- The agent does not authorise the hold itself. That step is out of scope (see 1).
- LMS training deadlines are configured separately. The value is TBD (see 8).

### D-6 Contractor compliance track

This rule is a design assumption. Confirm it with HR (see 8).

- On intake, the worker type comes from the source payload. `EMPLOYEE` uses the employee track. `CONTRACTOR` uses the contractor track.
- If the worker type is missing or contradicts the source record, the agent does not choose a track. It sets `CONTRACTOR_TRACK_AMBIGUITY`, escalates, and starts a 4-hour SLA clock.
- A contractor without complete compliance documentation at Day 2 gets the same handling as D-5, plus `CONTRACTOR_TRACK_AMBIGUITY`.

### D-7 Failure handling

- **Source API outage.** If the Workday or ServiceNow API times out twice, the affected identity check is marked `IDENT_UNVERIFIED` and escalated. A background probe runs every 5 minutes and retries automatically on recovery.
- **Enterprise API error storm.** If 5xx errors persist for more than 10 minutes, writes go to a transactional outbox. HR Ops is alerted. Urgent compliance and I-9 escalations continue through the HR Ops queue with `FLAG_PENDING`. The outbox drains FIFO on recovery.
- **Replays and bursts.** Webhook replays within 24 hours are dropped by event-ID idempotency. When alerts exceed 50 per minute, a circuit breaker returns 503 to the gateway so the gateway buffers. An ops alarm is raised. Email and portal channels keep running.
- **Fail toward escalation.** Any failure with no safe automatic action sends the record to HR Ops, not to a guessed result.

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
- Any delta over the statutory threshold sets `SLA_BREACH`. Threshold values are TBD (see 8).

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

## 8. Open items

Resolved in revision 2: undefined states and flags (3.2, 3.3), contractor track (D-6), concurrency lock (D-3), and burst behaviour (D-7).

These still need a decision before build:

1. **Statutory thresholds and LMS deadline.** M1 and D-5 need the I-9 and training deadline values. Confirm with HR and legal.
2. **Task count.** The brief says about 40 tasks, but M3 counts 36 automated tasks in Categories 1 to 4. Confirm the task inventory and category mapping.
3. **Category 5.** M2 refers to Category 5 (HITL exceptions), but the brief defines no category list.
4. **I-9 hold ownership.** I-9 hold authorisation is out of scope, yet D-5 sets `I9_COMPLIANCE_HOLD` and a Workday status. Confirm who owns the hold decision.
5. **SLA basis.** `sla_deadline` has no defined start point. Choose Workday hire date, start date, or payload receipt.
6. **LLM timeout and retries.** Not specified for the cloud LLM gateway, though D-1 depends on it and the 30-second latency target applies.
7. **Workday rate limit.** The 60 requests per minute limit may not fit a burst of 220 hires on one day. Model the peak load.
8. **Vendor choice.** The gateway could be Azure OpenAI, AWS Bedrock or Anthropic Enterprise. The choice affects the data processing terms in section 6.
9. **Contractor track assumption.** Confirm the D-6 rules with HR.
