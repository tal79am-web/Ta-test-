'use client';

import { useState } from 'react';

interface ExportButtonProps {
  data: unknown[];
  filename: string;
}

type ExportFormat = 'json' | 'csv' | 'markdown';

/**
 * ExportButton — exports opportunity data as JSON, CSV, or Markdown.
 */
export function ExportButton({ data, filename }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  function exportAs(format: ExportFormat) {
    let content: string;
    let mimeType: string;
    let ext: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        ext = 'json';
        break;

      case 'csv':
        content = toCSV(data);
        mimeType = 'text/csv';
        ext = 'csv';
        break;

      case 'markdown':
        content = toMarkdown(data);
        mimeType = 'text/markdown';
        ext = 'md';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary"
      >
        <span>↓ Export</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-20 w-40 card-elevated shadow-lg py-1">
            {(['json', 'csv', 'markdown'] as ExportFormat[]).map((format) => (
              <button
                key={format}
                onClick={() => exportAs(format)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2d2d4e] transition-colors"
              >
                {format === 'json'
                  ? 'JSON'
                  : format === 'csv'
                  ? 'CSV (spreadsheet)'
                  : 'Markdown'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function toCSV(data: unknown[]): string {
  if (!data || data.length === 0) return '';

  const first = data[0] as Record<string, unknown>;
  const headers = flattenKeys(first);
  const rows = data.map((row) => {
    const flat = flattenObject(row as Record<string, unknown>);
    return headers
      .map((h) => {
        const val = flat[h];
        if (val === null || val === undefined) return '';
        const str = Array.isArray(val) ? val.join('; ') : String(val);
        // Escape for CSV
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function toMarkdown(data: unknown[]): string {
  if (!data || data.length === 0) return '# No data\n';

  const lines: string[] = [`# OpportunityScout Export\n`, `*Exported: ${new Date().toLocaleString()}*\n\n---\n`];

  for (const item of data) {
    const opp = item as {
      title?: string;
      problemStatement?: string;
      targetAudience?: string;
      category?: string;
      score?: { composite?: number; volume?: number; marketSize?: number; significance?: number; urgency?: number };
      sources?: string[];
      keywords?: string[];
      solutionHints?: string[];
      revenueIndicators?: string[];
      createdAt?: string;
    };

    lines.push(`## ${opp.title ?? 'Untitled'}\n`);
    if (opp.category) lines.push(`**Category**: ${opp.category}\n`);
    if (opp.score?.composite !== undefined) {
      lines.push(
        `**Score**: ${opp.score.composite}/100 ` +
        `(Volume: ${opp.score.volume ?? '—'}, Market: ${opp.score.marketSize ?? '—'}, ` +
        `Significance: ${opp.score.significance ?? '—'}, Urgency: ${opp.score.urgency ?? '—'})\n`,
      );
    }
    if (opp.problemStatement) lines.push(`\n**Problem**: ${opp.problemStatement}\n`);
    if (opp.targetAudience) lines.push(`\n**Audience**: ${opp.targetAudience}\n`);
    if (opp.sources?.length) lines.push(`\n**Sources**: ${opp.sources.join(', ')}\n`);
    if (opp.keywords?.length) lines.push(`\n**Keywords**: ${opp.keywords.map((k) => `#${k}`).join(' ')}\n`);
    if (opp.solutionHints?.length) {
      lines.push('\n**Solution Hints**:\n');
      for (const hint of opp.solutionHints) lines.push(`- ${hint}\n`);
    }
    if (opp.revenueIndicators?.length) {
      lines.push('\n**Revenue Indicators**:\n');
      for (const ind of opp.revenueIndicators) lines.push(`- ${ind}\n`);
    }
    if (opp.createdAt) {
      lines.push(`\n*Found: ${new Date(opp.createdAt).toLocaleDateString()}*\n`);
    }
    lines.push('\n---\n');
  }

  return lines.join('');
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      Object.assign(result, flattenObject(val as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = val;
    }
  }

  return result;
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      keys.push(...flattenKeys(val as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}
