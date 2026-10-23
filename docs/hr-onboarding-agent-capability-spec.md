# Artifact 3: Capability Specification (HR Onboarding Coordination Agent)

Status: Revision 3. Base text is the revised Artifact 3 brief. Sections marked **Restored** keep content from revision 2 that the revised brief dropped, because the validation design depends on it. Section 7 lists open items.

## 1. Purpose and scope

**Purpose.** Coordinate and manage new-hire onboarding for 220+ annual hires by ingesting multi-source payloads across 4 systems, tracking ~40 tasks across 1 week, automating routine execution (~85%), detecting and packaging ~15% judgment calls, and ensuring 100% SLA compliance without anything falling through the cracks, utilising zero on-premise AI infrastructure.

**In scope:** Multi-channel intake normalisation (Workday, ServiceNow, LMS, email), identity resolution, task orchestration (~40 tasks across 1 week), duplicate filtering, standard task execution, judgment-call packaging, PII encryption at rest and in transit, and automated queue and circuit-breaker management.

**Out of scope:** Core HR policy design, software licence changes, payroll execution, I-9 hold authorisation (HL), manager performance management, notification dispatch (plain automation).

## 2. Inputs and outputs

**Inputs**

- Workday JSON webhooks (Core HR)
- ServiceNow webhooks (IT requests)
- LMS webhooks (compliance training)
- Inbound email and form submissions (unstructured coverage)

**Outputs**

- Updated enterprise records (Workday, ServiceNow, LMS)
- HR Ops escalation queue payloads
- PagerDuty and webhook alerting payloads
- State-transition events

**Operational targets**

- End-to-end intake-to-normalisation latency under 30 seconds.
- Malformed extraction alert above 2% per day.
- Queued enterprise API writes drain FIFO on recovery through a Redis/Celery job queue.
- Webhook burst above 50 alerts per minute triggers intake protection and circuit breaking. Three consecutive 5xx errors trip the circuit for 60 seconds (see D-7).

## 3. Entity and state model, security constraints

### 3.1 Data security and privacy controls

- **Encryption.** All candidate PII, notes, and I-9 metadata must be encrypted in transit (TLS 1.3) and at rest (AES-256).
- **Data residency.** Data residency requirements are TBD (see 7).
- **Purging.** Non-hired candidate records and their PII undergo automated TTL purging after 90 days.

### 3.2 Entity model

**`NewHireRecord`**

- `id` (UUID, primary key)
- `source` enum [`WORKDAY`, `SERVICENOW`, `LMS`, `EMAIL`]
- `candidate_id` (nullable, string)
- `worker_type` enum [`EMPLOYEE`, `CONTRACTOR`, null] (**Restored**, see D-6)
- `onboarding_status` enum [`RECEIVED`, `NORMALISED`, `IDENTIFIED`, `TASKS_INITIALISED`, `IN_PROGRESS`, `ESCALATED`, `IDENT_FAILED`, `IDENT_UNVERIFIED`, `PENDING_DECISION`, `DUPLICATE_HELD`, `QUARANTINED`, `TERMINATED`, `COMPLETED`]
- `flags[]` (string array, see 3.4)
- `timestamps` (JSON dictionary of state transition times)
- `sla_deadline` (timestamp; start point TBD, see 7)

**`TaskRecord`**

- `id` (UUID, primary key)
- `new_hire_id` (UUID, foreign key to `NewHireRecord`)
- `task_name` (string)
- `system_target` enum [`WORKDAY`, `SERVICENOW`, `LMS`, `INTERNAL`]
- `status` enum [`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `SKIPPED`]
- `due_timestamp` (timestamp)
- `completed_timestamp` (nullable, timestamp)

**`AuditLog`**

- `record_id` (UUID)
- `from_state` (string)
- `to_state` (string)
- `actor` (string)
- `reason` (string)
- `timestamp` (timestamp)

### 3.3 State machine and transitions

**Main pipeline:** `RECEIVED` → `NORMALISED` → `IDENTIFIED` → `TASKS_INITIALISED` → `IN_PROGRESS` → `COMPLETED` (terminal)

**State meanings.** The enum in 3.2 lists every status. This table gives the exception and recovery states.

| State | Meaning | Source |
|---|---|---|
| `ESCALATED` | General exception, routed to the HR Ops queue | D-1, D-2, D-5, D-6 |
| `IDENT_FAILED` | Fuzzy score below 0.95, or multiple candidate matches. Routed to the HR Ops queue. | D-2 |
| `IDENT_UNVERIFIED` | Identity cannot be checked because a source API is unavailable. The probe in D-7 retries it. | D-7 |
| `QUARANTINED` | Three cumulative normalisation failures. Exits only through the admin override in 3.4, or to `TERMINATED`. | D-1 |
| `TERMINATED` | Quarantined record closed by an admin. Terminal. **Restored, trigger detail TBD (see 7).** | D-1 |
| `PENDING_DECISION` | First of two concurrent requests for one candidate. Holds the identity lock. **Restored.** | D-3 |
| `DUPLICATE_HELD` | Duplicate that does not meet the auto-merge rule. Not processed until HR Ops decides. **Restored.** | D-3 |

**Quarantine release.** A record in `QUARANTINED` returns to `RECEIVED` only through the HR admin override API, with the admin as actor. No automatic release exists.

Every transition is immutably logged as `{record_id, from, to, actor, reason, timestamp}`.

### 3.4 Flag registry

| Flag | Set by | Meaning |
|---|---|---|
| `LLM_FALLBACK_USED` | D-1 | Regex parser produced the result, not the LLM |
| `NOTES_TRUNCATED` | D-1 | Notes or email body cut at 2,000 characters |
| `UNCLASSIFIED` | D-1 | Candidate details cannot be extracted. Record escalates. **Restored as a flag. Revision 3 lists it as a tag.** |
| `IDENT_FUZZY` | D-2 | Identity matched at score 0.95 or higher, not exactly |
| `BUDDY_MATCH_FAILED` | D-4 | No buddy found after the fallback sequence. Mentor is null. |
| `BUDDY_SENIORITY_REVIEW` | D-4 | Mentor seniority is ambiguous |
| `I9_COMPLIANCE_HOLD` | D-5 | I-9 documentation missing at Day 2 |
| `CONTRACTOR_TRACK_AMBIGUITY` | D-6 | Contractor compliance track cannot be set safely. **Restored.** |
| `FLAG_PENDING` | D-7 | Urgent item held during an enterprise API outage. **Restored.** |
| `SLA_BREACH` | M1 | A compliance task exceeded its statutory threshold |

The Workday profile status `PENDING_COMPLIANCE` is written by D-5. It is not a record flag.

## 4. Core decision logic

### D-1 Normalisation (cloud LLM API with fallback)

1. Send unstructured text and email payloads to the enterprise cloud LLM API with a structured JSON output schema.
2. **Truncation rule.** Free-text `notes` or email body fields over 2,000 characters are truncated safely and flagged `NOTES_TRUNCATED`. Intake never fails because of length. The JSON schema envelope is never truncated.
3. **API failure fallback.** If the LLM call fails, times out, or returns a malformed schema, run the deterministic regex keyword parser and set `LLM_FALLBACK_USED`. If candidate details still cannot be extracted, set `UNCLASSIFIED` and escalate.
4. **Failure threshold.** Three cumulative normalisation failures set the record to `QUARANTINED`.
5. **Enum enforcement.** LLM output outside the schema enums is treated as malformed and follows step 3.

LLM timeout and retry values are TBD (see 7).

### D-2 Identification

- Exact match on candidate email or ID in the Workday directory.
- Fuzzy match with score of 0.95 or higher proceeds with `IDENT_FUZZY`.
- Score below 0.95, or multiple candidate matches, sets `IDENT_FAILED` and escalates.
- **Never guess an identity.**

### D-3 Duplicate detection

- **Concurrency protection.** A database-level unique index and a distributed lock on `(candidate_id, active_status)` prevent race conditions during webhook bursts above 50 alerts per minute. The first request acquires the lock and moves to `PENDING_DECISION`. The second moves to `DUPLICATE_HELD`. **Restored from revision 2.**
- **Deduplication rule.** Candidate ID, task type, and an open task less than 72 hours old make a duplicate candidate. Auto-merge occurs only for exact same system events with zero exception flags. Other duplicates move to `DUPLICATE_HELD`.

### D-4 Standard task automation (about 40 tasks)

Automated generation of about 40 tasks over a 1-week window:

- IT provisioning
- Benefits enrolment
- Compliance training assignment
- Buddy matching
- Welcome materials
- 30-day checkpoint scheduling
- Manager handoff

**Buddy matching fallback hierarchy.** Match a peer by department and location, with mentor tenure of at least 1 year. If no exact match exists, apply this sequence:

1. Same department, and remote or global location, with tenure of at least 1 year.
2. Cross-department, same location, with tenure of at least 1 year.
3. If all criteria fail, set `BUDDY_MATCH_FAILED`, assign a null mentor, and route to HR Ops without blocking onboarding.

Seniority ambiguity sets `BUDDY_SENIORITY_REVIEW`.

### D-5 Compliance and I-9 verification

- **Anchor.** Day 0 is the candidate's official start date, parsed from Workday Core HR.
- **Statutory windows.** I-9 verification must be completed within statutory windows: a Day 3 requirement with a Day 2 check. If documentation is missing at Day 2, then:
  - set `I9_COMPLIANCE_HOLD`
  - open a high-priority HR Ops ticket with a 4-hour SLA clock
  - set the candidate profile in Workday to `PENDING_COMPLIANCE`
- The agent does not authorise the hold. That step is out of scope (see 1).
- LMS training deadlines are configured separately. The value is TBD (see 7).

### D-6 Contractor compliance track (Restored)

This rule is a design assumption. HR must confirm it (see 7).

- On intake, `worker_type` comes from the source payload. `EMPLOYEE` uses the employee track. `CONTRACTOR` uses the contractor track.
- If the worker type is missing or contradicts the source record, the agent does not choose a track. It sets `CONTRACTOR_TRACK_AMBIGUITY`, escalates, and starts a 4-hour SLA clock.
- A contractor without complete compliance documentation at Day 2 gets the D-5 handling, plus `CONTRACTOR_TRACK_AMBIGUITY`.

### D-7 Failure handling (Restored and extended)

- **Source API outage.** If the Workday or ServiceNow API times out twice, the affected identity check is marked `IDENT_UNVERIFIED` and escalated. A background probe runs every 5 minutes and retries automatically on recovery.
- **Circuit breaker.** Three consecutive 5xx responses from an enterprise API open the circuit for 60 seconds. Writes queue while it is open.
- **Enterprise API error storm.** If 5xx errors persist for more than 10 minutes, writes go to a transactional outbox. HR Ops is alerted. Urgent compliance and I-9 escalations continue through the HR Ops queue with `FLAG_PENDING`. The outbox drains FIFO on recovery.
- **Replays and bursts.** Webhook replays within 24 hours are dropped by event-ID idempotency. When alerts exceed 50 per minute, intake protection returns 503 to the gateway so the gateway buffers. An ops alarm is raised. Email and portal channels keep running.
- **Fail toward escalation.** Any failure with no safe automatic action sends the record to HR Ops, never to a guessed result.

## 5. Integration contracts and AI security layer

### 5.1 Contracts

- **Cloud LLM gateway.** HTTPS REST to a managed enterprise LLM API (Azure OpenAI, AWS Bedrock, or Anthropic Enterprise). Auth is an API key in the enterprise secrets manager. Zero data retention agreement: the company data is never used for model training.
- **Workday (Core HR).** `POST /api/v3/workers`, OAuth2. Idempotency key `source_report_id`. For unstructured or email payloads without a native ID, generate a deterministic hash: `SHA-256(sender_email + candidate_name + date truncated to hour)`. Timeout 8s, retry 3 times, rate limit 60 requests per minute.
- **ServiceNow (IT provisioning).** `POST /api/v2/table/task`, OAuth2, timeout 8s, retry 3 times.
- **LMS (compliance).** `POST /api/v1/enrollments`, API key auth, timeout 10s, retry 2 times.
- **Alerting.** PagerDuty Events API v2, or a configured Slack webhook, for critical infrastructure alerts and orphaned-task escalations.

### 5.2 AI security

- **Data handling.** Candidate PII reaches the LLM gateway in normalisation payloads. Confirm the zero-retention clause and data processing agreement before go-live.
- **Secrets.** All API keys live in the enterprise secrets manager. None are stored in code or logs.
- **Output validation.** Every LLM response passes schema validation before any write. A failed check triggers the D-1 fallback.
- **Fallback safety.** The regex parser never writes an identity. It can only feed D-2, which requires an exact or high-confidence match.

## 6. Telemetry contracts (M1 to M5)

**M1 (compliance and SLA breach tracking)**

- The state machine records exact timestamps when I-9 and LMS training tasks are triggered and when they complete or escalate.
- `audit_log_trail` computes `sla_delta_hours = completion_timestamp - trigger_timestamp`.
- Any delta over the statutory threshold sets `SLA_BREACH`. Threshold values are TBD (see 7).

**M2 (judgment error and override telemetry)**

- Every HITL exception resolution (Category 5) records the human actor ID and a required root-cause tag: `AGENT_MISS`, `MANAGER_ERROR`, or `DATA_SOURCE_LAG`.
- Table `escalation_resolution_table` holds `override_flag` (boolean) and `root_cause_tag` (enum).

**M3 (administrative hours reduction)**

- `system_execution_log` records `automated_duration_seconds` for Categories 1 to 4 (the 36 automated tasks).
- Labour hours saved equal the benchmark manual time (about 150 hours baseline) minus automated execution time.

**M4 (orphaned task and drop-off)**

- A background health check runs every 30 minutes via Celery and Redis.
- It finds records in `IN_PROGRESS` with no active timer for more than 4 hours.
- Each stalled record increments `orphaned_task_counter` and triggers a PagerDuty or webhook alert.
- Target: 0% unflagged drop-offs.

**M5 (task completion latency)**

- Ingestion and the workflow engine record end-to-end timestamps per hire record.
- `new_hire_records` stores `total_onboarding_duration_days`.
- A dashboard query measures the share of hires completed within the 1-week target window. Target: 100%.

## 7. Open items

These need a decision before build.

1. **Statutory thresholds and LMS deadline.** M1 and D-5 need the I-9 and training deadline values. Confirm with HR and legal.
2. **Task count.** The brief says about 40 tasks, but M3 counts 36 automated tasks in Categories 1 to 4. Confirm the task inventory and category mapping.
3. **Category 5.** M2 refers to Category 5 (HITL exceptions), but the brief defines no category list.
4. **Status enum reconciliation.** Revision 3 dropped `UNCLASSIFIED`, `PENDING_DECISION`, `DUPLICATE_HELD`, and `IDENT_UNVERIFIED` from the enum. This revision restores them. `UNCLASSIFIED` is now a flag, because the D-1 text calls it a tag. Confirm.
5. **`TERMINATED` trigger.** The brief names the exit but not who can trigger it or what it requires.
6. **Record retention.** The 90-day TTL purge covers non-hired candidates only. Confirm the retention period for hired records' I-9 metadata with legal, since I-9 retention rules run from hire or termination dates.
7. **Idempotency hash.** The email hash truncates to the hour. Two separate emails from one sender with the same name inside one hour would merge. Confirm this is acceptable.
8. **Buddy fallback criterion 1.** "Remote or global location" needs a definition from HR.
9. **Data residency.** The brief lists data residency under security controls but gives no requirement. Confirm the region rules.
10. **I-9 hold ownership.** I-9 hold authorisation is out of scope, yet D-5 sets `I9_COMPLIANCE_HOLD` and a Workday status. Confirm who owns the hold decision.
11. **SLA basis.** `sla_deadline` has no defined start point. Choose Workday hire date, start date, or payload receipt. Day 0 is the official start date (D-5), which suggests start date.
12. **LLM timeout and retries.** Not specified for the cloud LLM gateway, though D-1 depends on it and the 30-second latency target applies.
13. **Workday rate limit.** The 60 requests per minute limit may not fit a burst of 220 hires on one day. Model the peak load.
14. **Vendor choice.** The gateway could be Azure OpenAI, AWS Bedrock, or Anthropic Enterprise. The choice affects data processing terms (section 5.2).
15. **Contractor track assumption.** Confirm the D-6 rules with HR.
