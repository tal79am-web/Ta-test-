import { dayDiff } from "./calendar";

// R7: buddy proposal, using the fixtures README rules.
// Eligible: same site, different team from the hire, employee, active,
// tenure >= 183 days at start date, buddy load <= 1.
// Ranked by absolute level gap, then buddy load, then earlier hire date, then worker ID.
// Seniority flag: the top-ranked candidate's absolute level gap exceeds the norm.

export interface DirectoryEntry {
  workerId: string;
  workerType: string | null;
  status: "active" | "on_leave" | "terminated";
  site: string;
  team: string;
  level: number;
  hireDate: string;
  buddyLoad: number;
}

export interface BuddyPolicy {
  minTenureDays: number;
  maxBuddyLoad: number;
  maxLevelGap: number;
}

export const DEFAULT_BUDDY_POLICY: BuddyPolicy = {
  minTenureDays: 183,
  maxBuddyLoad: 1,
  maxLevelGap: 2,
};

export interface BuddyHire {
  workerId: string;
  site: string;
  team: string;
  jobLevel: number;
  startDate: string;
}

export interface BuddyScored {
  workerId: string;
  levelGap: number;
  rationale: string;
}

export interface BuddyResult {
  proposals: BuddyScored[];
  seniorityCrossed: boolean;
}

export function proposeBuddies(
  hire: BuddyHire,
  directory: readonly DirectoryEntry[],
  policy: BuddyPolicy = DEFAULT_BUDDY_POLICY,
): BuddyResult {
  const eligible = directory.filter(
    (c) =>
      c.workerId !== hire.workerId &&
      c.workerType === "employee" &&
      c.status === "active" &&
      c.site === hire.site &&
      c.team !== hire.team &&
      dayDiff(c.hireDate, hire.startDate) >= policy.minTenureDays &&
      c.buddyLoad <= policy.maxBuddyLoad,
  );

  const ranked = eligible
    .map((c) => ({ c, levelGap: c.level - hire.jobLevel }))
    .sort(
      (a, b) =>
        Math.abs(a.levelGap) - Math.abs(b.levelGap) ||
        a.c.buddyLoad - b.c.buddyLoad ||
        a.c.hireDate.localeCompare(b.c.hireDate) ||
        a.c.workerId.localeCompare(b.c.workerId),
    );

  const proposals: BuddyScored[] = ranked.slice(0, 3).map(({ c, levelGap }) => {
    const sign = levelGap >= 0 ? "+" : "";
    return {
      workerId: c.workerId,
      levelGap,
      rationale: `same site ${c.site}; team ${c.team} differs from ${hire.team}; tenure ${dayDiff(c.hireDate, hire.startDate)} days; buddy load ${c.buddyLoad}; level gap ${sign}${levelGap}`,
    };
  });

  const seniorityCrossed = proposals.length > 0 && Math.abs(proposals[0].levelGap) > policy.maxLevelGap;
  return { proposals, seniorityCrossed };
}
