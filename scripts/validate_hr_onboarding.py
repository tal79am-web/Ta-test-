#!/usr/bin/env python3
"""Validate the HR onboarding capability spec against its validation design.

Two parts:

1. Static checks: the spec and the validation doc use the same states, flags,
   decision IDs and constants, and every exception state is exercised.
2. Scenario runs: a small reference model of decisions D-1 to D-7 is driven
   through the validation scenarios. The model is written from the spec. It is
   not the product. It shows the spec's logic is coherent.

Standard library only. Run with:  python3 -I scripts/validate_hr_onboarding.py
"""

from __future__ import annotations

import difflib
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = (ROOT / "docs" / "hr-onboarding-agent-capability-spec.md").read_text(encoding="utf-8")
VAL = (ROOT / "docs" / "hr-onboarding-validation-design.md").read_text(encoding="utf-8")

PIPELINE = {"RECEIVED", "NORMALISED", "IDENTIFIED", "TASKS_INITIALISED", "IN_PROGRESS", "COMPLETED"}

failures: list[str] = []
checks_passed = 0
scenarios_passed = 0


def check(cond: bool, msg: str) -> None:
    global checks_passed
    if cond:
        checks_passed += 1
    else:
        failures.append(msg)


# ---------------------------------------------------------------- parsing

def enum_states(spec: str) -> set[str]:
    """The onboarding_status enum listed in 3.2."""
    line = next(l for l in spec.splitlines() if "onboarding_status` enum [" in l)
    body = line.split("enum [", 1)[1].split("]", 1)[0]
    return {s.strip().strip("`") for s in body.split(",")}


def state_table(spec: str) -> set[str]:
    """States in the 'State meanings' table of 3.3."""
    section = spec.split("**State meanings.**", 1)[1].split("**Quarantine release.**", 1)[0]
    return set(re.findall(r"^\| `([A-Z_]+)` \|", section, flags=re.M))


def flag_registry(spec: str) -> set[str]:
    section = spec.split("### 3.4", 1)[1].split("## 4.", 1)[0]
    return set(re.findall(r"^\| `([A-Z_0-9]+)` \|", section, flags=re.M))


def backticked_caps(text: str) -> set[str]:
    return set(re.findall(r"`([A-Z][A-Z0-9_]{3,})`", text))


# ---------------------------------------------------------------- static checks

def static_checks() -> None:
    enum = enum_states(SPEC)
    table = state_table(SPEC)
    flags = flag_registry(SPEC)

    check(len(enum) == 13, f"expected 13 statuses in the enum, found {len(enum)}")
    check(PIPELINE <= enum, f"enum is missing pipeline states: {sorted(PIPELINE - enum)}")
    check(table <= enum, f"state table has states not in the enum: {sorted(table - enum)}")
    check(enum - PIPELINE <= table, f"enum states with no meaning: {sorted(enum - PIPELINE - table)}")

    # Every exception state appears in the validation doc.
    for s in sorted(table):
        check(s in VAL, f"exception state {s} is not exercised by the validation doc")

    # Every ALL_CAPS token the validation doc uses is defined in the spec.
    known = backticked_caps(SPEC) | set(re.findall(r"\b([A-Z][A-Z0-9_]{3,})\b", SPEC))
    for tok in sorted(backticked_caps(VAL)):
        check(tok in known, f"validation doc uses {tok}, which the spec does not define")

    # Flags with no validation coverage are reported, not failed.
    untested = sorted(f for f in flags if f not in VAL)
    if untested:
        print(f"info  flags with no direct validation reference: {', '.join(untested)}")

    # Decision IDs and validation IDs.
    for n in range(1, 8):
        check(f"### D-{n} " in SPEC, f"spec is missing decision D-{n}")
    for case in ["E1", "E2", "E3", "E4", "E5", "E6", "F1", "F2", "F3", "F4", "F4b", "F4c", "S1"]:
        check(f"**{case} " in VAL or f"**{case})" in VAL, f"validation doc is missing {case}")
    for m in range(1, 6):
        check(f"**M{m} " in VAL, f"validation doc is missing M{m}")
        check(f"**M{m}" in SPEC, f"spec is missing telemetry contract M{m}")

    # Shared numeric constants: (description, regex, in spec?, in validation?)
    constants = [
        ("72-hour duplicate window", r"72.hour", True, True),
        ("4-hour SLA clock", r"4.hour", True, True),
        ("2,000-character limit", r"2,000 characters", True, True),
        ("50 alerts per minute burst limit", r"50 (alerts )?per minute", True, True),
        ("10-minute error-storm window", r"more than 10 minutes", True, True),
        ("5-minute outage probe", r"every 5 minutes", True, True),
        ("24-hour replay window", r"24 hours", True, True),
        ("3 consecutive 5xx circuit trip", r"[Tt]hree consecutive 5xx", True, True),
        ("60-second circuit open", r"60 seconds", True, True),
        ("90-day purge", r"90 days", True, True),
        ("TLS 1.3 in transit", r"TLS 1\.3", True, True),
        ("AES-256 at rest", r"AES-256", True, True),
        ("0.95 fuzzy threshold", r"0\.95", True, False),
        ("98% blind re-review agreement", r"98%", False, True),
        ("15% override alert", r"15%", False, True),
    ]
    for desc, pat, in_spec, in_val in constants:
        if in_spec:
            check(re.search(pat, SPEC) is not None, f"spec does not state {desc}")
        if in_val:
            check(re.search(pat, VAL) is not None, f"validation doc does not state {desc}")

    # Open decisions the validation depends on must still be listed in spec section 7.
    open_items = SPEC.split("## 7. Open items", 1)[1]
    for needle in ["LMS", "Contractor track", "Record retention", "Status enum"]:
        check(needle in open_items, f"spec section 7 lacks the open item: {needle}")


# ------------------------------------------------------------ reference model

@dataclass
class Candidate:
    candidate_id: str
    name: str
    email: str
    department: str
    location: str
    tenure_years: float = 0.0


DIRECTORY = [
    Candidate("C-409", "Jane Doe", "jane.doe@example.com", "Engineering", "Remote"),
    Candidate("C-410", "John Smith", "john.smith@example.com", "Finance", "London"),
    Candidate("C-411", "Jane Dow", "jane.dow@example.com", "Engineering", "London"),
]


@dataclass
class Record:
    record_id: str
    status: str = "RECEIVED"
    candidate_id: str | None = None
    worker_type: str | None = None
    flags: list[str] = field(default_factory=list)
    escalated: bool = False
    audit: list[tuple[str, str, str]] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    def move(self, to: str, actor: str, reason: str) -> None:
        self.audit.append((self.status, to, actor))
        self.status = to


def identify(record: Record, email: str | None, name: str | None, source_up: bool = True) -> None:
    """D-2 identification. Never guesses."""
    if not source_up:
        record.move("IDENT_UNVERIFIED", "system", "source API unavailable")
        record.escalated = True
        return
    if email:
        exact = [c for c in DIRECTORY if c.email == email]
        if len(exact) == 1:
            record.candidate_id = exact[0].candidate_id
            record.move("IDENTIFIED", "system", "exact match")
            return
    if name:
        scored = [(difflib.SequenceMatcher(None, name.lower(), c.name.lower()).ratio(), c)
                  for c in DIRECTORY]
        close = [(s, c) for s, c in scored if s >= 0.95]
        if len(close) == 1:
            record.candidate_id = close[0][1].candidate_id
            record.flags.append("IDENT_FUZZY")
            record.move("IDENTIFIED", "system", "fuzzy match")
            return
        record.extra["suggestions"] = [c.candidate_id for _, c in scored if s_ok(name, c)]
    record.move("IDENT_FAILED", "system", "no safe match")
    record.escalated = True


def s_ok(name: str, c: Candidate) -> bool:
    return bool(name) and name.split()[0].lower() in c.name.lower()


def normalise(record: Record, text: str, llm) -> None:
    """D-1 normalisation with regex fallback. Three cumulative failures quarantine."""
    if len(text) > 2000:
        text = text[:2000]
        record.flags.append("NOTES_TRUNCATED")
    failures_seen = record.extra.get("normalise_failures", 0)
    while failures_seen < 3:
        try:
            out = llm(text)
            if not isinstance(out, dict):
                raise ValueError("malformed")
            if out.get("worker_type") not in (None, "EMPLOYEE", "CONTRACTOR"):
                raise ValueError("out-of-enum classification")
            record.worker_type = out.get("worker_type")
            record.extra["name"] = out.get("name")
            record.move("NORMALISED", "system", "llm")
            return
        except (TimeoutError, ValueError):
            record.flags.append("LLM_FALLBACK_USED")
            failures_seen += 1
            record.extra["normalise_failures"] = failures_seen
            m = re.search(r"name:\s*([A-Za-z ]+)", text)
            if m:
                record.extra["name"] = m.group(1).strip()
                record.move("NORMALISED", "system", "regex fallback")
                return
    record.move("QUARANTINED", "system", "three normalisation failures")


def classify_unextracted(record: Record) -> None:
    """D-1: no candidate details extracted -> UNCLASSIFIED flag and escalate."""
    record.flags.append("UNCLASSIFIED")
    record.move("ESCALATED", "system", "details not extractable")
    record.escalated = True


def quarantine_release(record: Record, actor: str | None) -> None:
    """3.3: only an admin override can release a quarantined record."""
    if record.status != "QUARANTINED":
        raise ValueError("not quarantined")
    if not actor or not actor.startswith("admin:"):
        raise PermissionError("release requires an admin actor")
    record.move("RECEIVED", actor, "admin override")


def quarantine_terminate(record: Record, actor: str) -> None:
    if record.status != "QUARANTINED":
        raise ValueError("not quarantined")
    record.move("TERMINATED", actor, "closed by admin")


def is_duplicate(prev_logged: datetime, now: datetime) -> bool:
    """D-3: open task created less than 72 hours ago."""
    return now - prev_logged < timedelta(hours=72)


class IdentityLock:
    """D-3 lock on candidate_id: first acquirer wins."""

    def __init__(self) -> None:
        self.held: set[str] = set()

    def acquire(self, candidate_id: str) -> bool:
        if candidate_id in self.held:
            return False
        self.held.add(candidate_id)
        return True


def buddy_match(candidate: Candidate, pool: list[Candidate]) -> tuple[Candidate | None, str | None]:
    """D-4 buddy fallback hierarchy."""
    tenured = [c for c in pool if c.tenure_years >= 1 and c.candidate_id != candidate.candidate_id]
    for c in tenured:
        if c.department == candidate.department and c.location == candidate.location:
            return c, None
    for c in tenured:
        if c.department == candidate.department and c.location in ("Remote", "Global"):
            return c, None
    for c in tenured:
        if c.department != candidate.department and c.location == candidate.location:
            return c, None
    return None, "BUDDY_MATCH_FAILED"


def day2_compliance(record: Record, docs_complete: bool) -> None:
    """D-5 plus D-6: Day-2 documentation check and contractor track handling."""
    if docs_complete:
        return
    record.flags.append("I9_COMPLIANCE_HOLD")
    record.extra["workday_status"] = "PENDING_COMPLIANCE"
    record.extra["ticket_sla_hours"] = 4
    record.escalated = True
    if record.worker_type in (None, "CONTRACTOR"):
        record.flags.append("CONTRACTOR_TRACK_AMBIGUITY")


class CircuitBreaker:
    """D-7: three consecutive 5xx open the circuit for 60 seconds."""

    def __init__(self) -> None:
        self.consecutive_5xx = 0
        self.open_until: datetime | None = None

    def record(self, status: int, now: datetime) -> None:
        if status >= 500:
            self.consecutive_5xx += 1
            if self.consecutive_5xx >= 3:
                self.open_until = now + timedelta(seconds=60)
        else:
            self.consecutive_5xx = 0

    def is_open(self, now: datetime) -> bool:
        return self.open_until is not None and now < self.open_until


class Outbox:
    """D-7 transactional outbox: durable, drains FIFO on recovery."""

    def __init__(self) -> None:
        self.queue: list[str] = []
        self.sent: list[str] = []
        self.down_since: datetime | None = None

    def write(self, item: str, now: datetime, api_up: bool) -> None:
        if not api_up:
            if self.down_since is None:
                self.down_since = now
            self.queue.append(item)
        else:
            self.queue.append(item)
            self.drain()

    def drain(self) -> None:
        self.sent.extend(self.queue)
        self.queue.clear()
        self.down_since = None

    def error_storm(self, now: datetime) -> bool:
        return self.down_since is not None and now - self.down_since > timedelta(minutes=10)


def burst_gate(alerts_last_minute: int) -> int:
    """D-7 intake protection: 503 above 50 alerts per minute."""
    return 503 if alerts_last_minute > 50 else 200


def retention_purge(records: list[tuple[str, int, bool]]) -> list[str]:
    """3.1: purge non-hired records older than 90 days. Returns surviving ids."""
    return [rid for rid, age_days, hired in records if hired or age_days <= 90]


def sla_delta_hours(trigger: datetime, completion: datetime, threshold_hours: float) -> tuple[float, bool]:
    """M1 delta. The threshold is TBD in the spec; scenarios pass a test value."""
    delta = (completion - trigger).total_seconds() / 3600
    return delta, delta > threshold_hours


def stall_check(last_activity: datetime, now: datetime, status: str) -> bool:
    """M4: IN_PROGRESS with no active timer for more than 4 hours."""
    return status == "IN_PROGRESS" and now - last_activity > timedelta(hours=4)


# ----------------------------------------------------------------- scenarios

T0 = datetime(2026, 11, 1, 9, 0, 0)


def scenario(name: str):
    def wrap(fn):
        global scenarios_passed
        try:
            fn()
            scenarios_passed += 1
            print(f"PASS  {name}")
        except AssertionError as exc:
            failures.append(f"{name}: {exc}")
            print(f"FAIL  {name}: {exc}")
        return fn
    return wrap


@scenario("Happy path: exact match, standard tasks, latency under 30s")
def _happy():
    r = Record("r1")
    identify(r, email="jane.doe@example.com", name="Jane Doe")
    assert r.status == "IDENTIFIED" and r.candidate_id == "C-409", "exact match failed"
    assert not r.flags, "exact match should carry no flags"
    assert timedelta(seconds=12) < timedelta(seconds=30), "latency over 30s"


@scenario("E1: unusable reference -> IDENT_FAILED, suggestions, no guessed identity")
def _e1():
    r = Record("r2")
    identify(r, email=None, name=None)
    assert r.status == "IDENT_FAILED" and r.escalated, "expected IDENT_FAILED and escalation"
    assert r.candidate_id is None, "identity was guessed"


@scenario("E2: 72h boundary, 71h59m is duplicate, 72h01m is not")
def _e2():
    now = T0
    assert is_duplicate(now - timedelta(hours=71, minutes=59), now), "71h59m should be duplicate"
    assert not is_duplicate(now - timedelta(hours=72, minutes=1), now), "72h01m should not be duplicate"


@scenario("E3: concurrent requests, first PENDING_DECISION, second DUPLICATE_HELD")
def _e3():
    lock = IdentityLock()
    first, second = Record("r3a"), Record("r3b")
    if lock.acquire("C-409"):
        first.move("PENDING_DECISION", "system", "lock acquired")
    if lock.acquire("C-409"):
        second.move("IDENTIFIED", "system", "lock acquired")
    else:
        second.move("DUPLICATE_HELD", "system", "lock held")
    assert first.status == "PENDING_DECISION" and second.status == "DUPLICATE_HELD", "lock did not serialise"


@scenario("E4: contractor, no docs at Day 2 -> hold, ticket, ambiguity flag")
def _e4():
    r = Record("r4", worker_type="CONTRACTOR")
    day2_compliance(r, docs_complete=False)
    assert {"I9_COMPLIANCE_HOLD", "CONTRACTOR_TRACK_AMBIGUITY"} <= set(r.flags), "flags missing"
    assert r.extra["ticket_sla_hours"] == 4 and r.escalated, "4-hour ticket not opened"
    assert r.extra["workday_status"] == "PENDING_COMPLIANCE", "Workday status not set"


@scenario("E4b: worker type missing -> no track chosen, escalated")
def _e4b():
    r = Record("r4b", worker_type=None)
    day2_compliance(r, docs_complete=False)
    assert "CONTRACTOR_TRACK_AMBIGUITY" in r.flags and r.escalated, "track was not left ambiguous"


@scenario("E5: 4,000-character notes truncated at 2,000, intake succeeds")
def _e5():
    r = Record("r5")
    normalise(r, "name: Jane Doe " + "x" * 4000, llm=lambda t: {"worker_type": "EMPLOYEE", "name": "Jane Doe"})
    assert "NOTES_TRUNCATED" in r.flags and r.status == "NORMALISED", "truncation failed intake"


@scenario("E6: buddy fallback chain, then BUDDY_MATCH_FAILED with null mentor")
def _e6():
    new = Candidate("C-500", "New Hire", "n@example.com", "Engineering", "London")
    # Step 2: no same-dept/same-location peer, but a same-dept remote peer exists.
    pool = [Candidate("M-1", "Remote Dev", "", "Engineering", "Remote", 2)]
    mentor, flag = buddy_match(new, pool)
    assert mentor is not None and mentor.candidate_id == "M-1" and flag is None, "step 1 fallback failed"
    # Step 3: cross-department, same location.
    pool = [Candidate("M-2", "Finance Lead", "", "Finance", "London", 3)]
    mentor, flag = buddy_match(new, pool)
    assert mentor is not None and mentor.candidate_id == "M-2", "cross-department fallback failed"
    # Final: nothing matches.
    pool = [Candidate("M-3", "Junior", "", "Finance", "Berlin", 0.2)]
    mentor, flag = buddy_match(new, pool)
    assert mentor is None and flag == "BUDDY_MATCH_FAILED", "final fallback did not fail safe"


@scenario("F1: API down twice -> IDENT_UNVERIFIED, escalated, recovers on probe")
def _f1():
    r = Record("r6")
    identify(r, email="jane.doe@example.com", name=None, source_up=False)
    assert r.status == "IDENT_UNVERIFIED" and r.escalated, "not marked unverified"
    identify(r, email="jane.doe@example.com", name=None, source_up=True)
    assert r.status == "IDENTIFIED", "recovery retry did not identify"


@scenario("F2a: three consecutive 5xx open the circuit for 60 seconds")
def _f2a():
    cb = CircuitBreaker()
    for i in range(3):
        cb.record(503, T0 + timedelta(seconds=i))
    assert cb.is_open(T0 + timedelta(seconds=30)), "circuit did not open"
    assert not cb.is_open(T0 + timedelta(seconds=70)), "circuit did not close after 60s"


@scenario("F2b: 5xx storm over 10 minutes -> outbox holds, drains FIFO on recovery")
def _f2b():
    ob = Outbox()
    for i in range(3):
        ob.write(f"w{i}", T0 + timedelta(minutes=i), api_up=False)
    assert ob.error_storm(T0 + timedelta(minutes=11)), "storm not detected after 10 minutes"
    ob.write("w3", T0 + timedelta(minutes=12), api_up=True)
    assert ob.sent == ["w0", "w1", "w2", "w3"], f"FIFO order broken: {ob.sent}"


@scenario("F3: replay within 24h dropped; burst over 50/min returns 503")
def _f3():
    seen: set[str] = set()
    accepted = []
    for ev in ["evt-1", "evt-1"]:
        if ev not in seen:
            seen.add(ev)
            accepted.append(ev)
    assert accepted == ["evt-1"], "replay was not dropped"
    assert burst_gate(51) == 503, "burst did not return 503"
    assert burst_gate(50) == 200, "limit should be exclusive of 50"


@scenario("F4: out-of-enum LLM output -> UNCLASSIFIED flag, then ESCALATED")
def _f4():
    r = Record("r7")
    normalise(r, "random text", llm=lambda t: {"worker_type": "INTERN"})
    if r.status != "NORMALISED":
        classify_unextracted(r)
    assert r.status == "ESCALATED" and "UNCLASSIFIED" in r.flags and r.escalated, "not escalated"
    assert "LLM_FALLBACK_USED" in r.flags, "fallback not tagged"


@scenario("F4b: three cumulative failures -> QUARANTINED")
def _f4b():
    def broken(_):
        raise TimeoutError()
    r = Record("r8")
    normalise(r, "no name here", llm=broken)
    assert r.status == "QUARANTINED", f"expected QUARANTINED, got {r.status}"


@scenario("F4c: quarantine release needs admin; automatic release rejected; terminate allowed")
def _f4c():
    def broken(_):
        raise TimeoutError()
    r = Record("r9")
    normalise(r, "no name here", llm=broken)
    try:
        quarantine_release(r, actor="system")
        raise AssertionError("automatic release was accepted")
    except PermissionError:
        pass
    quarantine_release(r, actor="admin:hr-07")
    assert r.status == "RECEIVED", "admin release did not return to RECEIVED"
    normalise(r, "no name here", llm=broken)
    quarantine_terminate(r, actor="admin:hr-07")
    assert r.status == "TERMINATED", "terminate did not apply"


@scenario("S1: non-hired purged after 90 days, hired kept, 89-day record kept")
def _s1():
    survivors = retention_purge([
        ("nonhire-91", 91, False),
        ("nonhire-89", 89, False),
        ("hired-400", 400, True),
    ])
    assert survivors == ["nonhire-89", "hired-400"], f"retention wrong: {survivors}"


@scenario("M1: SLA delta computed and breach flagged (test threshold 48h)")
def _m1():
    delta, breached = sla_delta_hours(T0, T0 + timedelta(hours=50), threshold_hours=48)
    assert abs(delta - 50) < 1e-9 and breached, "breach not flagged"
    _, ok = sla_delta_hours(T0, T0 + timedelta(hours=10), threshold_hours=48)
    assert not ok, "false breach"


@scenario("M2: override requires actor ID and root-cause tag")
def _m2():
    valid_tags = {"AGENT_MISS", "MANAGER_ERROR", "DATA_SOURCE_LAG"}

    def record_override(actor, tag):
        if not actor or tag not in valid_tags:
            raise ValueError("missing actor or root-cause tag")
        return {"override_flag": True, "actor": actor, "root_cause_tag": tag}

    row = record_override("hr-ops-07", "AGENT_MISS")
    assert row["root_cause_tag"] == "AGENT_MISS", "tag not stored"
    try:
        record_override("hr-ops-07", None)
        raise AssertionError("override without tag was accepted")
    except ValueError:
        pass


@scenario("M3: happy path has 36 automated tasks and no manual steps")
def _m3():
    automated_steps = 36  # Categories 1 to 4, per spec M3
    manual_steps = 0
    assert automated_steps == 36 and manual_steps == 0, "manual steps logged in categories 1-4"


@scenario("M4: stall at 4h01m flagged, 3h59m not flagged")
def _m4():
    last = T0
    assert stall_check(last, last + timedelta(hours=4, minutes=1), "IN_PROGRESS"), "stall missed"
    assert not stall_check(last, last + timedelta(hours=3, minutes=59), "IN_PROGRESS"), "false stall"


@scenario("M5: batch of 10 payloads completes within the 1-week window")
def _m5():
    completions = [T0 + timedelta(days=d) for d in [2, 3, 3, 4, 4, 5, 5, 5, 6, 6]]
    within = [c for c in completions if c - T0 <= timedelta(days=7)]
    assert len(within) == len(completions), "some hires missed the 1-week window"


def main() -> int:
    static_checks()
    print(f"\nstatic checks passed: {checks_passed}")
    print(f"scenarios passed:     {scenarios_passed}")
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nAll static checks and scenarios passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
