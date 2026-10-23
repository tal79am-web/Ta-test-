// R7: buddy proposal. Rule-based scoring only. The rationale text is generated from
// the rules, so every proposal can be explained.

export interface DirectoryEntry {
  workerId: string;
  site: string;
  team: string;
  level: number;
  tenureMonths: number;
  buddyLoad: number;
  isManager?: boolean;
}

export interface BuddyPolicy {
  minTenureMonths: number;
  maxBuddyLoad: number;
  maxSeniorLevelGap: number;
}

export const DEFAULT_BUDDY_POLICY: BuddyPolicy = {
  minTenureMonths: 6,
  maxBuddyLoad: 1,
  maxSeniorLevelGap: 2,
};

export interface BuddyHire {
  workerId: string;
  site: string;
  team: string;
  jobLevel: number;
  managerId: string;
}

export interface BuddyScored {
  workerId: string;
  score: number;
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
      c.workerId !== hire.managerId &&
      c.isManager !== true &&
      c.site === hire.site &&
      c.team !== hire.team &&
      c.tenureMonths >= policy.minTenureMonths &&
      c.buddyLoad <= policy.maxBuddyLoad,
  );

  const scored: BuddyScored[] = eligible.map((c) => {
    const levelGap = c.level - hire.jobLevel;
    const tenureScore = Math.min(c.tenureMonths, 24) / 24;
    const loadScore = c.buddyLoad === 0 ? 1 : 0.5;
    const levelScore = 1 - Math.min(Math.abs(levelGap), 3) / 3;
    const score = Math.round((0.5 * tenureScore + 0.3 * loadScore + 0.2 * levelScore) * 1000) / 1000;
    const sign = levelGap >= 0 ? "+" : "";
    return {
      workerId: c.workerId,
      score,
      levelGap,
      rationale: `same site ${c.site}; team ${c.team} differs from ${hire.team}; tenure ${c.tenureMonths} months; buddy load ${c.buddyLoad}; level gap ${sign}${levelGap}`,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.workerId.localeCompare(b.workerId));
  const proposals = scored.slice(0, 3);
  const seniorityCrossed = proposals.length > 0 && proposals[0].levelGap > policy.maxSeniorLevelGap;
  return { proposals, seniorityCrossed };
}
