import { addBusinessDays, Calendar } from "./calendar";

// R6: deterministic I-9 deadline assessment. This module only reports. It has no
// path to place or release a hold; that decision belongs to a named human.

export interface I9Status {
  section1Done: boolean;
  section2Done: boolean;
}

export interface I9Finding {
  section: 1 | 2;
  deadline: string;
  status: "alert" | "breach";
}

/**
 * Section 1 is due by the first day of work. Section 2 is due within three
 * business days of start. An alert fires from one business day before a deadline
 * through the deadline itself. A breach fires only after the deadline has passed.
 */
export function assessI9(startDate: string, status: I9Status, today: string, cal: Calendar): I9Finding[] {
  const checks: { section: 1 | 2; done: boolean; deadline: string }[] = [
    { section: 1, done: status.section1Done, deadline: startDate },
    { section: 2, done: status.section2Done, deadline: addBusinessDays(startDate, 3, cal) },
  ];

  const findings: I9Finding[] = [];
  for (const check of checks) {
    if (check.done) continue;
    if (today > check.deadline) {
      findings.push({ section: check.section, deadline: check.deadline, status: "breach" });
    } else if (today >= addBusinessDays(check.deadline, -1, cal)) {
      findings.push({ section: check.section, deadline: check.deadline, status: "alert" });
    }
  }
  return findings;
}
