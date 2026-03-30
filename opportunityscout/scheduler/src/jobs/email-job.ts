import pino from 'pino';
import { Resend } from 'resend';
import { prisma } from '@opportunityscout/db';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { job: 'email' } });

interface EmailJobOptions {
  jobRunId?: string;
  date?: string; // YYYY-MM-DD, defaults to today
}

/**
 * Sends the daily summary email via Resend.
 *
 * Reads the DailySummary for the given date, formats it as HTML,
 * and sends it to the configured ALERT_EMAIL address.
 *
 * Requires:
 * - RESEND_API_KEY
 * - ALERT_EMAIL
 * - EMAIL_FROM (optional, defaults to noreply@opportunityscout.app)
 * - ENABLE_EMAIL=true
 */
export async function runEmailJob(options: EmailJobOptions = {}): Promise<void> {
  const startTime = Date.now();

  if (process.env['ENABLE_EMAIL'] !== 'true') {
    logger.info('Email sending disabled (ENABLE_EMAIL !== true) — skipping');
    return;
  }

  const resendApiKey = process.env['RESEND_API_KEY'];
  const alertEmail = process.env['ALERT_EMAIL'];

  if (!resendApiKey) {
    logger.warn('RESEND_API_KEY not set — skipping email job');
    return;
  }

  if (!alertEmail) {
    logger.warn('ALERT_EMAIL not set — skipping email job');
    return;
  }

  const date = options.date ?? new Date().toISOString().split('T')[0] as string;

  logger.info({ date, to: alertEmail }, 'Starting email job');

  if (options.jobRunId) {
    await prisma.jobRun.update({
      where: { id: options.jobRunId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  try {
    // Fetch the daily summary
    const summary = await prisma.dailySummary.findUnique({
      where: { date },
    });

    if (!summary) {
      logger.warn({ date }, 'No summary found for date — skipping email');
      return;
    }

    if (summary.emailSent) {
      logger.info({ date }, 'Email already sent for this date — skipping');
      return;
    }

    // Fetch top opportunities for the alert threshold check
    const settings = await prisma.settings.findFirst();
    const alertThreshold = settings?.alertThreshold ?? 75;

    const topOpportunities = await prisma.opportunity.findMany({
      where: {
        id: { in: summary.topOpportunityIds },
        scoreComposite: { gte: alertThreshold },
      },
      orderBy: { scoreComposite: 'desc' },
      take: 5,
    });

    if (topOpportunities.length === 0) {
      logger.info({ date, threshold: alertThreshold }, 'No opportunities above alert threshold — skipping email');
      return;
    }

    const resend = new Resend(resendApiKey);
    const fromAddress = process.env['EMAIL_FROM'] ?? 'OpportunityScout <noreply@opportunityscout.app>';

    const htmlContent = markdownToBasicHtml(summary.markdownContent);

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: alertEmail,
      subject: `OpportunityScout: ${topOpportunities.length} opportunities found — ${date}`,
      html: wrapInEmailTemplate(htmlContent, date, summary.totalOpportunitiesFound),
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    // Mark as sent
    await prisma.dailySummary.update({
      where: { date },
      data: { emailSent: true },
    });

    const durationMs = Date.now() - startTime;

    if (options.jobRunId) {
      await prisma.jobRun.update({
        where: { id: options.jobRunId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          durationMs,
        },
      });
    }

    logger.info({ date, to: alertEmail, durationMs }, 'Email sent successfully');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err, date }, 'Email job failed');

    if (options.jobRunId) {
      await prisma.jobRun.update({
        where: { id: options.jobRunId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          errorMessage,
        },
      });
    }

    throw err;
  }
}

/**
 * Very basic Markdown → HTML conversion for email.
 * For production, consider using a proper Markdown renderer like `marked`.
 */
function markdownToBasicHtml(markdown: string): string {
  return markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\|(.+)\|/g, (line) => {
      const cells = line.split('|').filter(Boolean).map((c) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>)/s, '<table>$1</table>');
}

function wrapInEmailTemplate(content: string, date: string, opportunityCount: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpportunityScout Daily Briefing — ${date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a2e; background: #f8f9fa; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { background: white; padding: 24px; border-radius: 8px; line-height: 1.6; }
    h2 { color: #667eea; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; }
    h3 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td, th { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
    tr:nth-child(even) { background: #f9f9f9; }
    .footer { text-align: center; margin-top: 24px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>OpportunityScout</h1>
    <p>${opportunityCount} opportunities found — ${date}</p>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>Sent by OpportunityScout &bull; <a href="${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}">View Dashboard</a></p>
  </div>
</body>
</html>`;
}
