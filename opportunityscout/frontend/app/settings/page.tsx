'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? '';

interface AppSettings {
  keywords: string[];
  enabledSources: string[];
  minOpportunityScore: number;
  scoreWeightVolume: number;
  scoreWeightMarketSize: number;
  scoreWeightSignificance: number;
  scoreWeightUrgency: number;
  emailAlertsEnabled: boolean;
  alertEmail: string;
  alertThreshold: number;
  crawlSchedule: string;
  maxConcurrentCrawlers: number;
  crawlerDelayMs: number;
}

const ALL_SOURCES = [
  { id: 'reddit', label: 'Reddit' },
  { id: 'hackernews', label: 'Hacker News' },
  { id: 'producthunt', label: 'Product Hunt' },
  { id: 'github', label: 'GitHub' },
  { id: 'stackoverflow', label: 'Stack Overflow' },
  { id: 'devto', label: 'Dev.to' },
  { id: 'g2reviews', label: 'G2 Reviews' },
  { id: 'indiehackers', label: 'IndieHackers' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    if (!settings) return;

    const sum =
      settings.scoreWeightVolume +
      settings.scoreWeightMarketSize +
      settings.scoreWeightSignificance +
      settings.scoreWeightUrgency;

    if (Math.abs(sum - 1.0) > 0.001) {
      setError(`Scoring weights must sum to 1.0 (current: ${sum.toFixed(3)})`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (!kw || !settings) return;
    if (settings.keywords.includes(kw)) return;
    setSettings((s) => s ? { ...s, keywords: [...s.keywords, kw] } : s);
    setKeywordInput('');
  }

  function removeKeyword(kw: string) {
    setSettings((s) => s ? { ...s, keywords: s.keywords.filter((k) => k !== kw) } : s);
  }

  function toggleSource(sourceId: string) {
    setSettings((s) => {
      if (!s) return s;
      const enabled = s.enabledSources.includes(sourceId)
        ? s.enabledSources.filter((id) => id !== sourceId)
        : [...s.enabledSources, sourceId];
      return { ...s, enabledSources: enabled };
    });
  }

  const weightSum = settings
    ? settings.scoreWeightVolume +
      settings.scoreWeightMarketSize +
      settings.scoreWeightSignificance +
      settings.scoreWeightUrgency
    : 0;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="page-title">Settings</h1>
        <div className="card p-8 text-center text-secondary">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Settings</h1>
        <div className="card p-8 text-center text-danger">
          {error ?? 'Failed to load settings. Make sure the backend is running and the database is seeded.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-secondary mt-1">Configure keywords, sources, and scoring</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
          Settings saved successfully!
        </div>
      )}

      {/* Keywords */}
      <section className="card p-6 space-y-4">
        <div>
          <h2 className="section-title">Keywords</h2>
          <p className="text-sm text-secondary mt-1">
            Keywords that boost opportunity scores when they appear in signal content.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add keyword..."
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            className="input flex-1"
          />
          <button onClick={addKeyword} className="btn-secondary">Add</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {settings.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm"
            >
              {kw}
              <button
                onClick={() => removeKeyword(kw)}
                className="hover:text-red-500 transition-colors ml-1"
              >
                ×
              </button>
            </span>
          ))}
          {settings.keywords.length === 0 && (
            <p className="text-sm text-secondary">No keywords configured.</p>
          )}
        </div>
      </section>

      {/* Sources */}
      <section className="card p-6 space-y-4">
        <div>
          <h2 className="section-title">Data Sources</h2>
          <p className="text-sm text-secondary mt-1">
            Enable or disable individual crawlers.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ALL_SOURCES.map((source) => (
            <label
              key={source.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-[#2d2d4e] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#252540] transition-colors"
            >
              <input
                type="checkbox"
                checked={settings.enabledSources.includes(source.id)}
                onChange={() => toggleSource(source.id)}
                className="rounded"
              />
              <span className="text-sm font-medium">{source.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Scoring Weights */}
      <section className="card p-6 space-y-5">
        <div>
          <h2 className="section-title">Scoring Weights</h2>
          <p className="text-sm text-secondary mt-1">
            Adjust how each dimension contributes to the composite score.{' '}
            <span className={Math.abs(weightSum - 1.0) > 0.001 ? 'text-red-500 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
              Sum: {weightSum.toFixed(2)} {Math.abs(weightSum - 1.0) > 0.001 ? '⚠ must equal 1.00' : '✓'}
            </span>
          </p>
        </div>

        {[
          { key: 'scoreWeightVolume' as const, label: 'Volume', description: 'Community engagement (upvotes, comments, views)' },
          { key: 'scoreWeightMarketSize' as const, label: 'Market Size', description: 'Commercial potential and revenue signals' },
          { key: 'scoreWeightSignificance' as const, label: 'Significance', description: 'Strategic and technical importance' },
          { key: 'scoreWeightUrgency' as const, label: 'Urgency', description: 'Timing and recency signals' },
        ].map(({ key, label, description }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <label className="label mb-0">{label}</label>
                <p className="text-xs text-secondary">{description}</p>
              </div>
              <span className="text-sm font-mono font-medium w-12 text-right">
                {(settings[key] * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings[key]}
              onChange={(e) =>
                setSettings((s) => s ? { ...s, [key]: parseFloat(e.target.value) } : s)
              }
              className="w-full accent-brand-600"
            />
          </div>
        ))}
      </section>

      {/* Thresholds */}
      <section className="card p-6 space-y-4">
        <h2 className="section-title">Thresholds</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Minimum Opportunity Score</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.minOpportunityScore}
              onChange={(e) =>
                setSettings((s) => s ? { ...s, minOpportunityScore: parseInt(e.target.value, 10) } : s)
              }
              className="input"
            />
            <p className="text-xs text-secondary mt-1">
              Opportunities scoring below this are discarded.
            </p>
          </div>

          <div>
            <label className="label">Email Alert Threshold</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.alertThreshold}
              onChange={(e) =>
                setSettings((s) => s ? { ...s, alertThreshold: parseInt(e.target.value, 10) } : s)
              }
              className="input"
            />
            <p className="text-xs text-secondary mt-1">
              Only opportunities above this score are included in the email.
            </p>
          </div>
        </div>
      </section>

      {/* Email */}
      <section className="card p-6 space-y-4">
        <h2 className="section-title">Email Alerts</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.emailAlertsEnabled}
            onChange={(e) =>
              setSettings((s) => s ? { ...s, emailAlertsEnabled: e.target.checked } : s)
            }
            className="rounded"
          />
          <span className="text-sm font-medium">Enable daily email summaries</span>
        </label>

        {settings.emailAlertsEnabled && (
          <div>
            <label className="label">Alert Email</label>
            <input
              type="email"
              value={settings.alertEmail}
              onChange={(e) =>
                setSettings((s) => s ? { ...s, alertEmail: e.target.value } : s)
              }
              className="input"
              placeholder="you@yourdomain.com"
            />
          </div>
        )}
      </section>

      {/* Crawler Config */}
      <section className="card p-6 space-y-4">
        <h2 className="section-title">Crawler Configuration</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Cron Schedule</label>
            <input
              type="text"
              value={settings.crawlSchedule}
              onChange={(e) =>
                setSettings((s) => s ? { ...s, crawlSchedule: e.target.value } : s)
              }
              className="input font-mono"
            />
            <p className="text-xs text-secondary mt-1">Standard cron expression (UTC)</p>
          </div>

          <div>
            <label className="label">Max Concurrent Crawlers</label>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.maxConcurrentCrawlers}
              onChange={(e) =>
                setSettings((s) => s ? { ...s, maxConcurrentCrawlers: parseInt(e.target.value, 10) } : s)
              }
              className="input"
            />
          </div>

          <div>
            <label className="label">Delay Between Requests (ms)</label>
            <input
              type="number"
              min={100}
              max={30000}
              step={100}
              value={settings.crawlerDelayMs}
              onChange={(e) =>
                setSettings((s) => s ? { ...s, crawlerDelayMs: parseInt(e.target.value, 10) } : s)
              }
              className="input"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
