# Review of the HR Onboarding Agent Spec

Reviewed file: `SPEC.md` in this folder.

## What checks out

- The arithmetic holds. 220 × 40 = 8,800; 15% of that is 1,320; 1,320 ÷ 220 = 6; 220 ÷ 52 ≈ 4.2 starts a week; 4.2 × 2 weeks ≈ 8.5 onboardings at once; 8.5 × 40 ≈ 340 open tasks.
- The delegation table has 5 fully agentic, 3 agent-led and 1 human-led family, which matches the summary sentence.
- The design rule holds throughout. The agent detects; no requirement gives it a hold or a track decision.

## Findings

1. **I-9 status has no read tool.** R6 takes I-9 status as input, but R5 lists no tool that reads it. Name the source system and add a read tool, or the monitor cannot run.
2. **No system of record for holds.** The spec says a human decides whether to place or release a hold, but never says where a hold lives. Name the system and who applies it.
3. **V4 timing conflicts with R6.** Section 2 is due within 3 business days of start. V4 sets the test on day 3 with Section 2 incomplete. That is at the deadline, not past it, so `I9_LATE` should not yet fire. Move the test to day 4, or define the trigger as "one business day before the deadline."
4. **SLA units differ.** R8 gives 4 for `I9_LATE` in business hours. V4 gives a 4-hour SLA. Decide whether the clock is business or calendar hours.
5. **The I-9 deadline metric has no owner.** "I-9 deadlines met: 100%" measures a human action, but the agent only alerts. Track the metric per owner, or the target can fail for reasons the agent cannot control.
6. **Recall target cannot be proven with 60 cases.** A 98% recall target needs many positive cases to show statistically. With 60 cases, perhaps 30 to 40 expect a flag, so a single miss already drops recall below the gate. Set a larger positive set, or state the confidence level that the gate requires.
7. **Labels inherit past mistakes.** The 40 replayed cases are labelled from last year's human outcomes. If those humans missed a flag, the suite rewards the same miss. Add a review step for the historical labels.
8. **Day 14 close and overdue tasks conflict.** The case closes at day 14, but the metric is "tasks overdue at day 14 ≤ 1%." Decide whether the close is blocked by overdue tasks or whether overdue tasks are counted and then closed.
9. **Compliance track assignment has no timeout.** R3 blocks the compliance task until a human decides. Nothing says what happens if no human answers before the start date. Add an SLA escalation path for `TRACK_AMBIGUOUS`.
10. **Two of six systems are unnamed.** This is already in U3, but the build plan cannot start connector work until it is resolved.

## Recommendation

Resolve findings 1 to 3 before Phase 2, because they change the I-9 monitor and the validation scenario it depends on. Findings 4 to 9 can be settled during Phase 0 discovery alongside U1 to U9.
