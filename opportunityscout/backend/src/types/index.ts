// =============================================================================
// Shared TypeScript types and interfaces for OpportunityScout backend
// =============================================================================

export type SignalCategory =
  | 'MARKET_GAP'
  | 'PAIN_POINT'
  | 'FEATURE_REQUEST'
  | 'NOISE';

export type SignalSource =
  | 'reddit'
  | 'hackernews'
  | 'producthunt'
  | 'github'
  | 'stackoverflow'
  | 'devto'
  | 'g2reviews'
  | 'indiehackers';

export type JobType = 'crawl' | 'analyze' | 'summary' | 'email' | 'all';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// -----------------------------------------------------------------------------
// Opportunity
// -----------------------------------------------------------------------------

export interface OpportunityScore {
  composite: number;       // 0–100 final weighted score
  volume: number;          // 0–100 community engagement
  marketSize: number;      // 0–100 commercial potential
  significance: number;    // 0–100 strategic importance
  urgency: number;         // 0–100 timing / recency
}

export interface OpportunityListItem {
  id: string;
  title: string;
  problemStatement: string;
  targetAudience: string;
  category: SignalCategory;
  score: OpportunityScore;
  sources: SignalSource[];
  signalCount: number;
  keywords: string[];
  isNew: boolean;          // First seen within the last 24 hours
  isRising: boolean;       // Score increased >10 points week-over-week
  createdAt: string;       // ISO 8601
  updatedAt: string;
}

export interface OpportunityDetail extends OpportunityListItem {
  solutionHints: string[];
  competitorContext: string;
  revenueIndicators: string[];
  signals: RawSignalSummary[];
  scoreHistory: ScoreHistoryPoint[];
}

export interface RawSignalSummary {
  id: string;
  source: SignalSource;
  url: string;
  title: string;
  score: number;
  commentCount: number;
  publishedAt: string;
  category: SignalCategory;
}

export interface ScoreHistoryPoint {
  date: string;            // YYYY-MM-DD
  composite: number;
}

// -----------------------------------------------------------------------------
// Daily Summary
// -----------------------------------------------------------------------------

export interface DailySummaryItem {
  id: string;
  date: string;            // YYYY-MM-DD
  markdownContent: string;
  topOpportunityIds: string[];
  totalSignalsProcessed: number;
  totalOpportunitiesFound: number;
  emailSent: boolean;
  generatedAt: string;
}

// -----------------------------------------------------------------------------
// Source Health
// -----------------------------------------------------------------------------

export interface SourceHealthStatus {
  source: SignalSource;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: JobStatus | null;
  signalsLastRun: number;
  totalSignals: number;
  errorMessage: string | null;
}

// -----------------------------------------------------------------------------
// Job
// -----------------------------------------------------------------------------

export interface JobRunRecord {
  id: string;
  jobType: JobType;
  status: JobStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  signalsProcessed: number;
  opportunitiesCreated: number;
  errorMessage: string | null;
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

export interface AppSettings {
  keywords: string[];
  enabledSources: SignalSource[];
  minOpportunityScore: number;
  scoreWeightVolume: number;
  scoreWeightMarketSize: number;
  scoreWeightSignificance: number;
  scoreWeightUrgency: number;
  emailAlertsEnabled: boolean;
  alertEmail: string;
  alertThreshold: number;     // Minimum score to trigger email alert
  crawlSchedule: string;      // Cron expression
  maxConcurrentCrawlers: number;
  crawlerDelayMs: number;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// API Request / Response helpers
// -----------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
}

export interface OpportunityListQuery {
  page?: number;
  limit?: number;
  sortBy?: 'composite' | 'volume' | 'marketSize' | 'significance' | 'urgency' | 'createdAt';
  order?: 'asc' | 'desc';
  minScore?: number;
  category?: SignalCategory;
  source?: SignalSource;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface RunJobBody {
  job: JobType;
}
