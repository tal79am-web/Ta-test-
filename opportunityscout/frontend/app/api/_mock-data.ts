/**
 * Demo mock data for OpportunityScout UI preview.
 * Used when NEXT_PUBLIC_DEMO_MODE=true or when the backend is unavailable.
 */

export const MOCK_OPPORTUNITIES = [
  {
    id: "opp_001",
    title: "AI-Powered Meeting Action Item Extractor",
    problemStatement: "Teams waste 20-40 minutes per meeting manually pulling action items from Zoom transcripts. Existing tools transcribe audio but none automatically categorise, assign, or track tasks.",
    targetAudience: "Remote-first teams using Zoom, Teams or Google Meet (5–500 employees)",
    category: "MARKET_GAP",
    score: { composite: 91, volume: 88, marketSize: 95, significance: 90, urgency: 85 },
    sources: ["reddit", "hackernews", "producthunt"],
    keywords: ["meeting", "action items", "zoom", "productivity", "automation"],
    firstSeenAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 74,
    isNew: false,
    isRising: true,
    rawSignalCount: 47,
    evidenceSources: [
      "https://reddit.com/r/productivity/comments/abc123",
      "https://news.ycombinator.com/item?id=38420100",
      "https://www.producthunt.com/discussions/meeting-tools"
    ],
    scoreHistory: generateHistory(91, 30),
  },
  {
    id: "opp_002",
    title: "Solo Freelancer Contract Risk Analyser",
    problemStatement: "Contract review tools like Ironclad and ContractPodAi cost $500–$2000/month — well beyond solo freelancers. 60M+ US gig workers sign risky contracts with no affordable legal AI.",
    targetAudience: "Solo freelancers and independent contractors (US, UK, EU)",
    category: "MARKET_GAP",
    score: { composite: 87, volume: 72, marketSize: 98, significance: 85, urgency: 80 },
    sources: ["reddit", "twitter", "indiehackers"],
    keywords: ["freelance", "contract", "legal", "risk", "AI", "affordable"],
    firstSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 80,
    isNew: false,
    isRising: true,
    rawSignalCount: 38,
    evidenceSources: [
      "https://reddit.com/r/freelance/comments/xyz789",
      "https://twitter.com/search?q=contract+review+freelancer"
    ],
    scoreHistory: generateHistory(87, 30),
  },
  {
    id: "opp_003",
    title: "Dev-to-Non-Tech Translation Layer for SaaS Teams",
    problemStatement: "Product managers and founders constantly request features that engineers have already built differently. An AI layer that automatically syncs engineering vocabulary with business language could eliminate 30% of cross-team miscommunication.",
    targetAudience: "SaaS companies with mixed technical and non-technical teams (10–200 people)",
    category: "PAIN_POINT",
    score: { composite: 83, volume: 78, marketSize: 82, significance: 88, urgency: 72 },
    sources: ["hackernews", "devto", "linkedin"],
    keywords: ["internal comms", "product management", "engineering", "translation", "AI"],
    firstSeenAt: new Date().toISOString(),
    previousScore: null,
    isNew: true,
    isRising: false,
    rawSignalCount: 29,
    evidenceSources: [
      "https://news.ycombinator.com/item?id=38500200",
      "https://dev.to/pmtools/bridging-the-gap"
    ],
    scoreHistory: generateHistory(83, 30),
  },
  {
    id: "opp_004",
    title: "Automated Recurring Revenue Forecasting for Indie SaaS",
    problemStatement: "Bootstrapped SaaS founders use spreadsheets for MRR forecasting because tools like Baremetrics ($250/mo) are priced for funded companies. Thousands of sub-$10k MRR founders lack affordable AI-driven churn and growth prediction.",
    targetAudience: "Bootstrapped SaaS founders with $1k–$30k MRR",
    category: "MARKET_GAP",
    score: { composite: 80, volume: 65, marketSize: 90, significance: 82, urgency: 75 },
    sources: ["indiehackers", "reddit", "twitter"],
    keywords: ["SaaS", "MRR", "forecasting", "churn", "bootstrapped", "affordable"],
    firstSeenAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 78,
    isNew: false,
    isRising: false,
    rawSignalCount: 24,
    evidenceSources: ["https://www.indiehackers.com/post/mrr-forecasting-tools"],
    scoreHistory: generateHistory(80, 30),
  },
  {
    id: "opp_005",
    title: "AI Code Review Bot for Non-GitHub Workflows",
    problemStatement: "GitHub Copilot and CodeRabbit only deeply integrate with GitHub. Teams using Bitbucket, GitLab self-hosted, or Azure DevOps get second-class AI review support. Millions of enterprise developers are underserved.",
    targetAudience: "Enterprise dev teams on Bitbucket/GitLab/Azure DevOps (50–5000 engineers)",
    category: "FEATURE_REQUEST",
    score: { composite: 78, volume: 82, marketSize: 85, significance: 70, urgency: 68 },
    sources: ["stackoverflow", "github", "devto"],
    keywords: ["code review", "AI", "Bitbucket", "GitLab", "Azure DevOps", "enterprise"],
    firstSeenAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 58,
    isNew: false,
    isRising: true,
    rawSignalCount: 61,
    evidenceSources: [
      "https://stackoverflow.com/questions/tagged/ai+code-review",
      "https://github.com/features/copilot/issues"
    ],
    scoreHistory: generateHistory(78, 30),
  },
  {
    id: "opp_006",
    title: "Customer Support Ticket Pre-Triage for Small Teams",
    problemStatement: "Small companies can't afford Zendesk's AI tier ($55+/seat/month). Front-line support reps manually categorise and prioritise hundreds of tickets daily. A $20/month AI triage layer for help desk tools could 10x their throughput.",
    targetAudience: "Small businesses with 2–10 person support teams using Freshdesk, Help Scout, or email",
    category: "MARKET_GAP",
    score: { composite: 75, volume: 70, marketSize: 78, significance: 76, urgency: 71 },
    sources: ["g2reviews", "reddit", "producthunt"],
    keywords: ["customer support", "helpdesk", "triage", "AI", "automation", "affordable"],
    firstSeenAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 73,
    isNew: false,
    isRising: false,
    rawSignalCount: 33,
    evidenceSources: ["https://www.g2.com/categories/help-desk/reviews"],
    scoreHistory: generateHistory(75, 30),
  },
  {
    id: "opp_007",
    title: "One-Click Privacy Policy Generator with Real-Time Compliance Updates",
    problemStatement: "GDPR, CCPA, and emerging state privacy laws change constantly. Indie developers copy-paste outdated privacy policies. A living-document AI that auto-updates policies as laws change could serve 30M+ indie developers and small SaaS operators.",
    targetAudience: "Indie developers and small SaaS companies launching consumer products",
    category: "PAIN_POINT",
    score: { composite: 72, volume: 55, marketSize: 88, significance: 74, urgency: 65 },
    sources: ["reddit", "hackernews", "devto"],
    keywords: ["privacy policy", "GDPR", "CCPA", "compliance", "legal", "indie dev"],
    firstSeenAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 69,
    isNew: false,
    isRising: false,
    rawSignalCount: 19,
    evidenceSources: ["https://reddit.com/r/SaaS/comments/privacy_policy_nightmare"],
    scoreHistory: generateHistory(72, 30),
  },
  {
    id: "opp_008",
    title: "AI-Driven Onboarding Flow Personalisation Engine",
    problemStatement: "SaaS products lose 70% of trial users in the first week because onboarding is one-size-fits-all. No affordable tool personalises the onboarding sequence based on the user's role, company size, and stated goals in real time.",
    targetAudience: "B2B SaaS companies with freemium or trial models (Series A–C)",
    category: "MARKET_GAP",
    score: { composite: 69, volume: 48, marketSize: 85, significance: 72, urgency: 62 },
    sources: ["producthunt", "linkedin", "crunchbase"],
    keywords: ["onboarding", "SaaS", "personalisation", "activation", "trial conversion"],
    firstSeenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 65,
    isNew: false,
    isRising: false,
    rawSignalCount: 17,
    evidenceSources: ["https://www.producthunt.com/discussions/onboarding-tools"],
    scoreHistory: generateHistory(69, 30),
  },
  {
    id: "opp_009",
    title: "Automated Changelog Generation from Git History",
    problemStatement: "Writing changelogs is one of the most complained-about developer chores. Tools like Changesets require manual annotation. An AI that reads git diffs and produces human-readable, user-facing changelogs in seconds fills a clear productivity gap.",
    targetAudience: "Developer tools companies and open-source maintainers",
    category: "FEATURE_REQUEST",
    score: { composite: 65, volume: 74, marketSize: 55, significance: 68, urgency: 58 },
    sources: ["github", "devto", "hackernews"],
    keywords: ["changelog", "git", "developer tools", "documentation", "automation"],
    firstSeenAt: new Date().toISOString(),
    previousScore: null,
    isNew: true,
    isRising: false,
    rawSignalCount: 42,
    evidenceSources: ["https://github.com/conventional-changelog/conventional-changelog/issues"],
    scoreHistory: generateHistory(65, 30),
  },
  {
    id: "opp_010",
    title: "Cross-Platform App Store Review Sentiment Dashboard",
    problemStatement: "Mobile developers monitor App Store and Play Store reviews manually or through expensive analytics suites. A sub-$50/month AI that clusters review sentiment by feature area and notifies teams of emerging issues would serve 5M+ app developers.",
    targetAudience: "Mobile app developers and growth teams at companies with 2+ apps",
    category: "PAIN_POINT",
    score: { composite: 62, volume: 52, marketSize: 70, significance: 65, urgency: 55 },
    sources: ["stackoverflow", "reddit", "producthunt"],
    keywords: ["app store", "reviews", "sentiment", "mobile", "analytics"],
    firstSeenAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    previousScore: 60,
    isNew: false,
    isRising: false,
    rawSignalCount: 14,
    evidenceSources: ["https://reddit.com/r/androiddev/comments/app_reviews_monitoring"],
    scoreHistory: generateHistory(62, 30),
  },
];

export const MOCK_SUMMARY = {
  id: "sum_001",
  date: new Date().toISOString().split("T")[0],
  totalSignalsProcessed: 2847,
  totalOpportunitiesFound: 10,
  emailSent: false,
  generatedAt: new Date().toISOString(),
  markdownContent: `# OpportunityScout Daily Briefing — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

**Signals crawled:** 2,847 across 11 sources
**Opportunities identified:** 10
**New today:** 2 | **Rising (>20% score gain):** 3

---

## #1 — AI-Powered Meeting Action Item Extractor (Score: 91/100)

**The problem:** Teams waste 20-40 minutes per meeting manually pulling action items from Zoom transcripts. Existing tools transcribe audio but none automatically categorise, assign, or track tasks.

**The AI solution:** An LLM-powered post-meeting agent that reads transcripts, extracts action items, infers owners from context, and syncs directly to Jira, Linear, or Notion.

**Who pays:** Remote-first teams using Zoom/Teams (5–500 employees). Pricing: $15–$50/seat/month.

> *"We spend more time writing up meeting notes than actually doing the work. Otter gives me the transcript but I still have to manually pull out the action items."* — r/productivity, 342 upvotes

---

## ONE BOLD PICK

**MeetingMind AI** — The $50M ARR opportunity hiding in every Zoom call.

Every knowledge worker attends 3–5 meetings per week. The last 10 minutes of every meeting are wasted on "who's doing what by when." An AI agent that joins calls silently, understands context, extracts commitments, and pushes tasks to the tools teams already use — would be the first productivity tool that **removes work rather than adding it**. Comparable to how Grammarly sits in every text field, MeetingMind would sit in every meeting. Target: 50M remote workers × $20/month = $12B TAM. Acqui-hire target for Zoom, Microsoft, or Atlassian within 3 years.
`,
};

export const MOCK_SOURCES = [
  { source: "reddit", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 312, totalSignals: 8420, errorMessage: null },
  { source: "twitter", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 189, totalSignals: 4210, errorMessage: null },
  { source: "hackernews", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 94, totalSignals: 2180, errorMessage: null },
  { source: "producthunt", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 78, totalSignals: 1920, errorMessage: null },
  { source: "github", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 143, totalSignals: 3600, errorMessage: null },
  { source: "stackoverflow", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 67, totalSignals: 1450, errorMessage: null },
  { source: "devto", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 45, totalSignals: 980, errorMessage: null },
  { source: "g2reviews", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 201, totalSignals: 5200, errorMessage: null },
  { source: "indiehackers", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 38, totalSignals: 890, errorMessage: null },
  { source: "crunchbase", enabled: true, lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: "completed", signalsLastRun: 112, totalSignals: 2760, errorMessage: null },
  { source: "linkedin", enabled: false, lastRunAt: null, lastRunStatus: null, signalsLastRun: 0, totalSignals: 0, errorMessage: "LI_AT session cookie not configured" },
];

export const MOCK_SETTINGS = {
  id: "default",
  keywords: ["AI", "automation", "SaaS", "no-code", "productivity"],
  enabledSources: ["reddit", "twitter", "hackernews", "producthunt", "github", "stackoverflow", "devto", "g2reviews", "indiehackers", "crunchbase"],
  minOpportunityScore: 40,
  scoreWeightVolume: 0.30,
  scoreWeightMarketSize: 0.30,
  scoreWeightSignificance: 0.25,
  scoreWeightUrgency: 0.15,
  emailAlertsEnabled: false,
  alertEmail: "",
  alertThreshold: 75,
  crawlSchedule: "0 5 * * *",
  maxConcurrentCrawlers: 3,
  crawlerDelayMs: 1500,
};

function generateHistory(currentScore: number, days: number) {
  const points = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const variance = (Math.random() - 0.5) * 15;
    const dayScore = Math.max(20, Math.min(100, Math.round(currentScore - (i * 0.3) + variance)));
    points.push({
      date: date.toISOString().split("T")[0],
      composite: dayScore,
      volume: Math.round(dayScore * (0.85 + Math.random() * 0.3)),
      marketSize: Math.round(dayScore * (0.9 + Math.random() * 0.2)),
      significance: Math.round(dayScore * (0.88 + Math.random() * 0.25)),
      urgency: Math.round(dayScore * (0.75 + Math.random() * 0.35)),
    });
  }
  return points;
}
