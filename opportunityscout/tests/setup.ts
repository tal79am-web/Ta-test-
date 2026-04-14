/**
 * Global test setup for OpportunityScout tests.
 *
 * Sets up environment variables so tests can run without a real database
 * by using mock/stub implementations.
 */

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/opportunityscout_test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['ANTHROPIC_API_KEY'] = 'test-key-not-real';
process.env['LOG_LEVEL'] = 'error'; // Suppress logs during tests
process.env['CRAWLER_DELAY_MS'] = '0'; // No delays in tests
