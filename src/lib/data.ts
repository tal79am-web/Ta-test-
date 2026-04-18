export interface Deal {
  id: string;
  name: string;
  company: string;
  sector: string;
  stage: string;
  targetRaise: number;
  raised: number;
  minInvestment: number;
  irr: number;
  multiple: number;
  status: "open" | "closing" | "closed" | "funded";
  deadline: string;
  description: string;
  logo: string;
  investors: number;
  featured?: boolean;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  members: number;
  minInvestment: number;
  focus: string[];
  totalDeployed: number;
  returns: number;
  avatar: string;
  isPrivate: boolean;
}

export interface PortfolioHolding {
  id: string;
  dealName: string;
  company: string;
  invested: number;
  currentValue: number;
  irr: number;
  multiple: number;
  stage: string;
  date: string;
  status: "active" | "exited" | "pending";
}

export const deals: Deal[] = [
  {
    id: "deal-1",
    name: "Series B Growth Round",
    company: "TechVision AI",
    sector: "Artificial Intelligence",
    stage: "Series B",
    targetRaise: 15_000_000,
    raised: 10_200_000,
    minInvestment: 25_000,
    irr: 28,
    multiple: 3.2,
    status: "open",
    deadline: "2026-05-30",
    description:
      "TechVision AI is building next-generation computer vision infrastructure for autonomous systems. Their proprietary edge AI chips outperform competitors by 4x while using 60% less power.",
    logo: "TV",
    investors: 47,
    featured: true,
  },
  {
    id: "deal-2",
    name: "Pre-IPO Round",
    company: "GreenEnergy Corp",
    sector: "Clean Energy",
    stage: "Pre-IPO",
    targetRaise: 50_000_000,
    raised: 38_500_000,
    minInvestment: 100_000,
    irr: 22,
    multiple: 2.5,
    status: "closing",
    deadline: "2026-04-25",
    description:
      "GreenEnergy Corp operates 12 utility-scale solar farms across the Southwest. With a PPA portfolio worth $800M and expanding into battery storage, this pre-IPO round offers liquidity at a discount.",
    logo: "GE",
    investors: 93,
    featured: true,
  },
  {
    id: "deal-3",
    name: "Seed Extension",
    company: "HealthSync",
    sector: "HealthTech",
    stage: "Seed",
    targetRaise: 3_000_000,
    raised: 1_800_000,
    minInvestment: 10_000,
    irr: 35,
    multiple: 4.1,
    status: "open",
    deadline: "2026-06-15",
    description:
      "HealthSync connects patients with specialists through AI-powered triage. 200K monthly active users, $2.4M ARR, growing 18% MoM.",
    logo: "HS",
    investors: 28,
  },
  {
    id: "deal-4",
    name: "Growth Capital",
    company: "LogiFlow",
    sector: "Logistics",
    stage: "Series A",
    targetRaise: 8_000_000,
    raised: 8_000_000,
    minInvestment: 50_000,
    irr: 19,
    multiple: 2.2,
    status: "funded",
    deadline: "2026-03-01",
    description:
      "LogiFlow's warehouse automation software reduced fulfillment errors by 94% for enterprise clients. Now serving 40+ warehouses across North America.",
    logo: "LF",
    investors: 62,
  },
  {
    id: "deal-5",
    name: "Bridge Round",
    company: "FinEdge",
    sector: "FinTech",
    stage: "Bridge",
    targetRaise: 5_000_000,
    raised: 2_100_000,
    minInvestment: 15_000,
    irr: 31,
    multiple: 3.8,
    status: "open",
    deadline: "2026-07-01",
    description:
      "FinEdge provides embedded lending infrastructure for SMBs. Their API-first platform processes $300M in loans monthly with a 1.2% default rate.",
    logo: "FE",
    investors: 19,
  },
  {
    id: "deal-6",
    name: "Real Estate Fund II",
    company: "Urban Capital Partners",
    sector: "Real Estate",
    stage: "Fund",
    targetRaise: 25_000_000,
    raised: 18_750_000,
    minInvestment: 50_000,
    irr: 16,
    multiple: 1.9,
    status: "open",
    deadline: "2026-06-30",
    description:
      "Urban Capital Partners targets value-add multifamily properties in high-growth Sun Belt markets. Fund I returned 2.1x to investors.",
    logo: "UC",
    investors: 54,
  },
];

export const clubs: Club[] = [
  {
    id: "club-1",
    name: "Silicon Valley Angels",
    description:
      "Focused on early-stage deep tech and AI investments. Members include former founders, CXOs, and active operators.",
    members: 142,
    minInvestment: 25_000,
    focus: ["AI/ML", "Deep Tech", "SaaS"],
    totalDeployed: 12_400_000,
    returns: 24.3,
    avatar: "SVA",
    isPrivate: false,
  },
  {
    id: "club-2",
    name: "Green Growth Collective",
    description:
      "Impact-focused investors targeting climate tech, clean energy, and sustainable agriculture.",
    members: 87,
    minInvestment: 10_000,
    focus: ["Clean Energy", "Climate Tech", "AgTech"],
    totalDeployed: 5_800_000,
    returns: 18.7,
    avatar: "GGC",
    isPrivate: false,
  },
  {
    id: "club-3",
    name: "Healthcare Innovators",
    description:
      "Physicians, biotech executives, and healthcare operators investing in the future of medicine.",
    members: 63,
    minInvestment: 50_000,
    focus: ["BioTech", "HealthTech", "MedDevice"],
    totalDeployed: 9_200_000,
    returns: 31.2,
    avatar: "HI",
    isPrivate: true,
  },
  {
    id: "club-4",
    name: "Real Estate Pro Network",
    description:
      "Experienced real estate professionals co-investing in commercial and residential opportunities.",
    members: 211,
    minInvestment: 25_000,
    focus: ["Commercial RE", "Multifamily", "Industrial"],
    totalDeployed: 28_500_000,
    returns: 15.4,
    avatar: "RE",
    isPrivate: false,
  },
];

export const portfolio: PortfolioHolding[] = [
  {
    id: "h-1",
    dealName: "Series A Round",
    company: "DataBridge",
    invested: 50_000,
    currentValue: 127_500,
    irr: 34.2,
    multiple: 2.55,
    stage: "Series A",
    date: "2023-06-15",
    status: "active",
  },
  {
    id: "h-2",
    dealName: "Seed Round",
    company: "PharmaLink",
    invested: 25_000,
    currentValue: 18_750,
    irr: -12.1,
    multiple: 0.75,
    stage: "Seed",
    date: "2024-01-20",
    status: "active",
  },
  {
    id: "h-3",
    dealName: "Series B",
    company: "CloudOps Pro",
    invested: 100_000,
    currentValue: 340_000,
    irr: 48.7,
    multiple: 3.4,
    stage: "Exited",
    date: "2022-03-10",
    status: "exited",
  },
  {
    id: "h-4",
    dealName: "Growth Round",
    company: "TechVision AI",
    invested: 25_000,
    currentValue: 27_500,
    irr: 5.2,
    multiple: 1.1,
    stage: "Series B",
    date: "2025-11-01",
    status: "active",
  },
  {
    id: "h-5",
    dealName: "Pre-IPO",
    company: "GreenEnergy Corp",
    invested: 100_000,
    currentValue: 108_000,
    irr: 8.0,
    multiple: 1.08,
    stage: "Pre-IPO",
    date: "2026-02-14",
    status: "pending",
  },
];
