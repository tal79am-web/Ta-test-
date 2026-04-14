import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic client singleton.
 *
 * Uses claude-sonnet-4-20250514 by default (configurable via ANTHROPIC_MODEL env var).
 * All API calls should go through this module to ensure consistent configuration.
 */
const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
});

export const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514';
export const MAX_TOKENS = parseInt(process.env['ANTHROPIC_MAX_TOKENS'] ?? '4096', 10);
export const TEMPERATURE = parseFloat(process.env['ANTHROPIC_TEMPERATURE'] ?? '0.3');

export default client;
