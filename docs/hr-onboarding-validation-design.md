# Artifact 4: Validation Design (HR Onboarding Coordination Agent)

Validated against the capability spec, revision 2. Run with `scripts/validate_hr_onboarding.py`.

## 1. Happy path

**Input.** The Workday webhook receives a full-time hire payload:

- `candidate_id`: C-409
- `name`: Jane Doe
- `start_date`: 2026-11-01
- `role`: Software Engineer
- `department`: Engineering
- `worker_type`: EMPLOYEE

**Flow.**

1. Exact match in the Workday directory (D-2).
2. About 40 standard tasks initialised across Workday, ServiceNow and the LMS (D-4).
3. IT provisioning tickets opened, compliance training assigned, welcome package dispatched.
4. The state-transition event triggers the automated welcome email.

**Expected outcome.** Latency under 30 seconds, a complete audit log, and zero HR Ops touches.

## 2. Edge cases

The design must handle each of these without breaking.

- **E1 (unusable reference).** An email from a hiring manager has no usable candidate reference: "we have a new dev starting Monday in tech services". The record moves to `IDENT_FAILED` and goes to the HR Ops queue. The queue item holds the extracted text and candidate search suggestions. The agent never guesses an identity. A near-match scoring 0.95 or higher proceeds with `IDENT_FUZZY` (D-2).
- **E2 (time boundary).** A duplicate request arrives at the 72-hour boundary. Test both sides: a prior request logged 71h59m ago, and one logged 72h01m ago (D-3).
- **E3 (concurrency burst).** A Workday webhook and a manager email for the same candidate arrive within seconds. The atomic distributed lock lets the first request win and move to `PENDING_DECISION`. The second moves to `DUPLICATE_HELD` (D-3).
- **E4 (policy exception).** A contractor onboarding request arrives without complete compliance documentation by Day 2. The record gets `I9_COMPLIANCE_HOLD` and `CONTRACTOR_TRACK_AMBIGUITY`, goes to the HR Ops queue, and starts a 4-hour SLA clock (D-5, D-6).
- **E5 (oversized input).** A manager's email notes field holds 4,000 characters of pasted text. Notes are truncated at 2,000 characters and flagged `NOTES_TRUNCATED`. Intake never fails (D-1).

## 3. Failure modes and recovery

- **F1 (API outage).** The Workday or ServiceNow API is down or times out twice. The record is marked `IDENT_UNVERIFIED` and escalated. A background probe runs every 5 minutes and retries automatically on recovery (D-7).
- **F2 (error storm).** Three consecutive 5xx responses from an enterprise API open the circuit for 60 seconds, and writes queue while it is open. If 5xx errors persist for more than 10 minutes, a transactional outbox queues writes durably. HR Ops is alerted. Urgent compliance and I-9 escalations continue through the HR Ops queue, flagged `FLAG_PENDING`. The queue drains FIFO on recovery (D-7).
- **F3 (replays and bursts).** Webhook replays within 24 hours are dropped by event-ID idempotency. When alerts exceed 50 per minute, intake protection returns 503 to the gateway so it buffers. An ops alarm is raised. Email and portal channels keep running (D-7).
- **F4 (malformed LLM output).** The LLM returns malformed output or a classification outside the enum. Schema validation rejects it and the record is tagged `LLM_FALLBACK_USED`. If no candidate details can be extracted, the record gets the `UNCLASSIFIED` flag and moves to `ESCALATED` for HR Ops review. The system fails toward escalation (D-1).
- **F4b (repeated normalisation failure).** Three cumulative normalisation failures set the record to `QUARANTINED`. It is not retried automatically (D-1).
- **F4c (quarantine release).** A quarantined record returns to `RECEIVED` only through the HR admin override, with the admin as actor. An automatic release is rejected. A quarantined record can also move to `TERMINATED` (3.3).

## 2a. Additional edge cases

- **E6 (buddy fallback).** No peer matches department and location with tenure of at least 1 year. The sequence tries same department with remote or global location, then cross-department with the same location. If both fail, the record gets `BUDDY_MATCH_FAILED`, a null mentor, and HR Ops routing, and onboarding continues. A mentor with ambiguous seniority gets `BUDDY_SENIORITY_REVIEW` (D-4).

## 3a. Security and retention

- **S1 (encryption and retention).** Candidate PII is encrypted in transit with TLS 1.3 and at rest with AES-256. A non-hired candidate record is purged at 90 days. A record 89 days old is kept. A hired candidate's record is not purged by this rule (3.1).

## 4. Quiet-failure monitoring

- **Weekly blind re-review.** An HR Ops specialist re-reviews 30 auto-processed records, stratified by department and source. Agreement below 98% triggers threshold retuning.
- **Escalation-outcome audit loop.** Any record followed within 7 days by a compliance flag, an audit discrepancy or a manual intervention gets root-cause tagging: `AGENT_MISS`, `MANAGER_ERROR` or `DATA_SOURCE_LAG`.
- **Distribution drift monitors.** Track daily onboarding volume, department mix, dedup-merge rate and mean extraction confidence against a 28-day rolling baseline. A deviation beyond ±3σ triggers review.
- **Override telemetry.** An HR Ops override rate above 15% on any trigger for one week indicates a mis-set rule or threshold.

## 5. Success metric telemetry and observability validation

The validation suite must confirm that the logging layer captures the data needed for M1 to M5.

**M1 (compliance SLA tracking)**

- *Scenario:* Simulate an onboarding record approaching the Day-2 I-9 deadline or the LMS training deadline. The LMS deadline value is TBD (spec section 8).
- *Assertion:* The system records the exact timestamp delta between task trigger and completion or escalation. Breaches are flagged `SLA_BREACH` automatically.

**M2 (judgment error and override telemetry)**

- *Scenario:* Trigger an identity match failure (E1) or a policy exception (E4), then simulate an HR Ops manual override.
- *Assertion:* The audit log captures the root-cause tag and the human actor ID, so monthly audit error rates can be computed.

**M3 (administrative hours reduction)**

- *Scenario:* Run a standard happy-path record through all 36 automated tasks.
- *Assertion:* No manual intervention is logged for Categories 1 to 4. Labour hours saved can be calculated from automated duration against the baseline manual time.

**M4 (orphaned task and drop-off audit)**

- *Scenario:* Simulate a stalled branch where an external API webhook never returns.
- *Assertion:* After the 4-hour threshold, the system flags an unflagged stall and fires an automated alert. The target is 0% unflagged drop-offs.

**M5 (end-to-end completion latency)**

- *Scenario:* Run a batch of mock onboarding payloads through the parallel durable workflow.
- *Assertion:* 100% of standard workflow completion timestamps fall within the 1-week target window. The source sentence was cut off, so this wording follows Artifacts 1 and 3. Confirm it (see 6).

## 6. Items to confirm

1. **LMS deadline.** M1 needs the LMS training deadline value. The spec leaves it TBD (spec section 7, item 1).
2. **M5 wording.** The assertion above completes a sentence cut off in the source. Confirm it.
3. **Contractor track.** E4 relies on the D-6 rules, which are an assumption until HR confirms them (spec section 7, item 15).
4. **Status and flag reconciliation.** Revision 3 moved `UNCLASSIFIED` to a flag. Validation F4 follows that. Confirm (spec section 7, item 4).
5. **Retention.** S1 assumes a 90-day purge for non-hired candidates. Hired-record retention is open (spec section 7, item 6).
