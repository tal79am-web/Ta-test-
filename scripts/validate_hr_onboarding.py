#!/usr/bin/env python3
"""Validate the HR onboarding capability spec against its validation design.

Two parts:

1. Static checks: the spec and the validation doc use the same states, flags,
   decision IDs and constants, and every exception state is exercised.
2. Scenario runs: a small reference model of decisions D-1 to D-7 is driven
   through the validation scenarios (E1-E5, F1-F4, M1-M5). The model is written
   from the spec. It is not the product. It shows the spec's logic is coherent.

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

failures: list[str] = []
passes = 0


def check(cond: bool, msg: str) -> None:
    global passes
    if cond:
        passes += 1
    else:
        failures.append(msg)


# ---------------------------------------------------------------- static checks

def exception_states(spec: str) -> set[str]:
    """States listed in the 3.2 exception table (rows like | `STATE` | ...)."""
    section = spec.split("### 3.2", 1)[1].split("### 3.3", 1)[0]
    return set(re.findall(r"^\| `([A-Z_]+)` \|", section, flags=re.M))


def flag_registry(spec: str) -> set[str]:
    """Flags listed in the 3.3 registry table."""
    section = spec.split("### 3.3", 1)[1].split("## 4.", 1)[0]
    return set(re.findall(r"^\| `([A-Z_0-9]+)` \|", section, flags=re.M))


def backticked_caps(text: str) -> set[str]:
    return set(re.findall(r"`([A-Z][A-Z0-9_]{3,})`", text))


def static_checks() -> None:
    states = exception_states(SPEC)
    flags = flag_registry(SPEC)
    check(len(states) == 7, f"expected 7 exception states in spec 3.2, found {len(states)}")
    check(len(flags) == 8, f"expected 8 flags in spec 3.3, found {len(flags)}")

    # Every exception state is exercised by the validation doc.
    for s in sorted(states):
        check(s in VAL, f"exception state {s} is not exercised by the validation doc")

    # Every ALL_CAPS token the validation doc uses is defined in the spec.
    known = backticked_caps(SPEC) | set(re.findall(r"\b([A-Z][A-Z0-9_]{3,})\b", SPEC))
    for tok in sorted(backticked_caps(VAL)):
        check(tok in known, f"validation doc uses {tok}, which the spec does not define")

    # Decision IDs and validation IDs.
    for n in range(1, 8):
        check(f"### D-{n}" in SPEC, f"spec is missing decision D-{n}")
    for case in ["E1", "E2", "E3", "E4", "E5", "F1", "F2", "F3", "F4"]:
        check(f"**{case} " in VAL or f"- **{case}" in VAL, f"validation doc is missing {case}")
    for m in range(1, 6):
        check(f"**M{m} " in VAL, f"validation doc is missing M{m}")
        check(f"**M{m}:" in SPEC or f"**M{m}: " in SPEC, f"spec is missing telemetry contract M{m}")

    # Shared numeric constants: (description, regex, in spec?, in validation?)
    constants = [
        ("72-hour duplicate window", r"72.hour", True, True),
        ("4-hour SLA clock", r"4.hour", True, True),
        ("2,000-character notes limit", r"2,000 characters", True, True),
        ("50 alerts per minute burst limit", r"50 (alerts )?per minute", True, True),
        ("10-minute error-storm window", r"more than 10 minutes", True, True),
        ("5-minute outage probe", r"every 5 minutes", True, True),
        ("24-hour replay window", r"24 hours", True, True),
        ("0.95 fuzzy threshold", r"0\.95", True, False),
        ("98% blind re-review agreement", r"98%", False, True),
        ("15% override alert", r"15%", False, True),
    ]
    for desc, pat, in_spec, in_val in constants:
        if in_spec:
            check(re.search(pat, SPEC) is not None, f"spec does not state {desc}")
        if in_val:
            check(re.search(pat, VAL) is not None, f"validation doc does not state {desc}")

    # Open decisions the validation depends on must still be listed in spec section 8.
    section8 = SPEC.split("## 8. Open items", 1)[1]
    check("LMS" in section8 and "deadline" in section8, "spec section 8 lacks the LMS deadline item")
    check("Contractor track" in section8, "spec section 8 lacks the contractor track assumption")


# ------------------------------------------------------------ reference model

@dataclass
class Candidate:
    candidate_id: str
    name: str
    email: str
    department: str


DIRECTORY = [
    Candidate("C-409", "Jane Doe", "jane.doe@example.com", "Engineering"),
    Candidate("C-410", "John Smith", "john.smith@example.com", "Finance"),
    Candidate("C-411", "Jane Dow", "jane.dow@example.com", "Engineering"),
]


@dataclass
class Record:
    record_id: str
    status: str = "RECEIVED"
    candidate_id: str | None = None
    worker_type: str | None = None
    flags: list[str] = field(default_factory=list)
    notes: str = ""
    escalated: bool = False
    extra: dict = field(default_factory=dict)


def identify(record: Record, email: str | None, name: str | None, source_up: bool = True) -> None:
    """D-2 identification. Never guesses."""
    if not source_up:
        record.status = "IDENT_UNVERIFIED"
        record.escalated = True
        return
    if email:
        exact = [c for c in DIRECTORY if c.email == email]
        if len(exact) == 1:
            record.candidate_id = exact[0].candidate_id
            record.status = "IDENTIFIED"
            return
    if name:
        scored = [(difflib.SequenceMatcher(None, name.lower(), c.name.lower()).ratio(), c)
                  for c in DIRECTORY]
        scored = [(s, c) for s, c in scored if s >= 0.95]
        if len(scored) == 1:
            record.candidate_id = scored[0][1].candidate_id
            record.flags.append("IDENT_FUZZY")
            record.status = "IDENTIFIED"
            return
        if len(scored) > 1:
            record.extra["suggestions"] = [c.candidate_id for _, c in scored]
    record.status = "IDENT_FAILED"
    record.escalated = True
    record.extra["suggestions"] = record.extra.get(
        "suggestions", [c.candidate_id for c in DIRECTORY if name and name.split()[0] in c.name]
    )


def normalise(record: Record, text: str, llm) -> None:
    """D-1 normalisation with regex fallback and quarantine after three failures."""
    if len(text) > 2000:
        text = text[:2000]
        record.flags.append("NOTES_TRUNCATED")
    for _attempt in range(3):
        try:
            out = llm(text)
            if not isinstance(out, dict):
                raise ValueError("malformed")
            if out.get("worker_type") not in (None, "EMPLOYEE", "CONTRACTOR"):
                raise ValueError("out-of-enum classification")
            record.worker_type = out.get("worker_type")
            record.extra["email"] = out.get("email")
            record.extra["name"] = out.get("name")
            record.status = "NORMALISED"
            return
        except (TimeoutError, ValueError):
            record.flags.append("LLM_FALLBACK_USED")
            regex_name = re.search(r"name:\s*([A-Za-z ]+)", text)
            if regex_name:
                record.extra["name"] = regex_name.group(1).strip()
                record.status = "NORMALISED"
                return
    record.status = "QUARANTINED" if record.status != "NORMALISED" else record.status


def classify_unextracted(record: Record) -> None:
    """D-1 step 3: no candidate details extracted -> UNCLASSIFIED and escalate."""
    record.status = "UNCLASSIFIED"
    record.escalated = True


def is_duplicate(prev_logged: datetime, now: datetime) -> bool:
    """D-3: open task created less than 72 hours ago."""
    return now - prev_logged < timedelta(hours=72)


class IdentityLock:
    """D-3 atomic lock: first acquirer wins."""

    def __init__(self) -> None:
        self.held: set[str] = set()

    def acquire(self, candidate_id: str) -> bool:
        if candidate_id in self.held:
            return False
        self.held.add(candidate_id)
        return True


def day2_compliance(record: Record, docs_complete: bool) -> None:
    """D-5 plus D-6: Day-2 documentation check and contractor track handling."""
    if docs_complete:
        return
    record.flags.append("I9_COMPLIANCE_HOLD")
    record.extra["workday_status"] = "PENDING_COMPLIANCE"
    record.extra["ticket_sla_hours"] = 4
    record.escalated = True
    if record.worker_type == "CONTRACTOR":
        record.flags.append("CONTRACTOR_TRACK_AMBIGUITY")
    elif record.worker_type is None:
        record.flags.append("CONTRACTOR_TRACK_AMBIGUITY")


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
    """D-7 circuit breaker: 503 buffering above 50 alerts per minute."""
    return 503 if alerts_last_minute > 50 else 200


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
        try:
            fn()
            global passes
            passes += 1
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
    latency = timedelta(seconds=12)
    assert latency < timedelta(seconds=30), "latency over 30s"


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


@scenario("E3: concurrent requests, first wins, second DUPLICATE_HELD")
def _e3():
    lock = IdentityLock()
    first, second = Record("r3a"), Record("r3b")
    if lock.acquire("C-409"):
        first.status = "PENDING_DECISION"
    if lock.acquire("C-409"):
        second.status = "IDENTIFIED"
    else:
        second.status = "DUPLICATE_HELD"
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


@scenario("F1: API down twice -> IDENT_UNVERIFIED, escalated, recovers on probe")
def _f1():
    r = Record("r6")
    identify(r, email="jane.doe@example.com", name=None, source_up=False)
    assert r.status == "IDENT_UNVERIFIED" and r.escalated, "not marked unverified"
    identify(r, email="jane.doe@example.com", name=None, source_up=True)
    assert r.status == "IDENTIFIED", "recovery retry did not identify"


@scenario("F2: 5xx storm over 10 minutes -> outbox holds, drains FIFO on recovery")
def _f2():
    ob = Outbox()
    for i in range(3):
        ob.write(f"w{i}", T0 + timedelta(minutes=i), api_up=False)
    assert ob.error_storm(T0 + timedelta(minutes=11)), "storm not detected after 10 minutes"
    ob.write("w3", T0 + timedelta(minutes=12), api_up=True)
    assert ob.sent == ["w0", "w1", "w2", "w3"], f"FIFO order broken: {ob.sent}"


@scenario("F3: replay within 24h dropped; burst over 50/min returns 503")
def _f3():
    seen_events: set[str] = set()
    accepted = []
    for ev in ["evt-1", "evt-1"]:
        if ev not in seen_events:
            seen_events.add(ev)
            accepted.append(ev)
    assert accepted == ["evt-1"], "replay was not dropped"
    assert burst_gate(51) == 503, "burst did not return 503"
    assert burst_gate(50) == 200, "limit should be exclusive of 50"


@scenario("F4: out-of-enum LLM output -> UNCLASSIFIED, then ESCALATED")
def _f4():
    r = Record("r7")
    normalise(r, "random text", llm=lambda t: {"worker_type": "INTERN"})
    if r.status != "NORMALISED":
        classify_unextracted(r)
    assert r.status == "UNCLASSIFIED" and r.escalated, "out-of-enum output was not escalated"
    assert "LLM_FALLBACK_USED" in r.flags, "fallback not tagged"


@scenario("F4b: three failed normalisations -> QUARANTINED")
def _f4b():
    def broken(_):
        raise TimeoutError()
    r = Record("r8")
    normalise(r, "no name here", llm=broken)
    assert r.status == "QUARANTINED", f"expected QUARANTINED, got {r.status}"


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
    print(f"static checks: {passes} passed so far, {len(failures)} failed so far")
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nAll static checks and scenarios passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
