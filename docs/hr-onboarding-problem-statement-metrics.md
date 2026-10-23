# Artifact 1: Problem Statement and Metrics (HR Onboarding Coordination Agent)

## The problem: reporter's perspective (HR Ops team)

The 3-person HR Ops team at a regional professional-services firm (1,200 employees, 220+ hires per year) runs as a manual human switchboard across a fragmented four-system stack: Workday (core HR), ServiceNow (IT requests), a separate LMS (compliance training), and email for everything else.

For every new hire, HR Ops manually coordinates about 40 tasks across a 2-week window. These include IT provisioning, benefits enrolment, compliance training assignment, buddy matching, welcome materials, 30-day checkpoint scheduling, and manager handoff. Each time HR Ops tries to automate with rigid scripts, edge cases break the workflow, because incoming details never look the same twice.

About 15% of tasks need human judgment. Examples include deciding between contractor and employee compliance tracks, judging whether a buddy assignment crosses seniority norms, and assessing whether a late I-9 triggers a legal hold. HR Ops staff spend their shifts chasing paperwork and piecing status together across systems. They have no real-time visibility, and no automated confirmation when cross-system handoffs stall.

## The problem: business perspective

- **Volume versus capacity.** 220+ hires per year, each generating about 40 tasks across four source systems. This load overwhelms a lean 3-person HR Ops team.
- **Operational inefficiency and fragmentation.** Task coordination spans four systems with no unified orchestration layer. HR Ops bridges Workday, ServiceNow, the LMS, and email by hand.
- **Compliance and legal risk.** Time-sensitive I-9 processing and regulatory training verification carry legal weight and strict deadlines. Missed steps or unhandled holds expose the firm to legal penalties.
- **Zero AI infrastructure and cold-start constraint.** The firm has no internal AI infrastructure, no local GPUs, no vector databases, and no MLOps tooling. Any intelligent automation must start from zero. It must use secure, zero-footprint enterprise cloud LLM APIs, without on-premise model hosting or complex internal AI plumbing.
- **Misallocation of scarce expertise.** HR Ops staff spend their time on repetitive tracking and edge-case chasing. They should be spending it on employee experience, strategic onboarding interventions, and complex policy exceptions.

## Explicitly out of scope

- Candidate background checks
- Core HR policy design
- Changes to underlying enterprise software licences (Workday, ServiceNow, LMS)
- Payroll execution
- Direct line-manager performance management

The sole focus is the coordination and orchestration layer. That layer ingests cross-system onboarding data, automates deterministic task sequences, detects and routes nuanced edge cases for human judgment, and ensures no task falls through the cracks.

## Success metrics (12 weeks post-deployment)

| # | Metric | Baseline | Target | Measured how |
|---|---|---|---|---|
| **M1** | Compliance and legal SLA breach rate (I-9 and mandatory training deadlines) | To be established via audit | ≤ 2% | Timestamp delta from task trigger to completion or escalation log |
| **M2** | Judgment call misclassification and error rate | About 15% unhandled or error-prone edge cases | ≤ 3% | Monthly blind audit of agent-routed versus human-resolved exceptions |
| **M3** | HR Ops administrative hours per onboarding | 150 hours (aggregate across 3 team members over 2 work weeks) | 60% reduction | Time-tracking logs across the HR Ops team |
| **M4** | Cross-system task drop-off ("falling through the cracks") rate | To be established via audit | 0% unflagged stalls | System audit logs tracking orphaned tasks across source systems |
| **M5** | New-hire onboarding task completion latency | About 2 weeks (ad-hoc tracking) | 100% on-time completion within the 1-week window | Automated workflow completion timestamps per hire |
