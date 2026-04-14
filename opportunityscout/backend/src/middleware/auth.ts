import type { Request, Response, NextFunction } from 'express';

/**
 * API key authentication middleware.
 * Reads the key from the X-API-Key header and compares against
 * the API_KEY environment variable using a constant-time comparison
 * to prevent timing attacks.
 */
export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const apiKey = process.env['API_KEY'];

  if (!apiKey) {
    res.status(500).json({
      error: 'ConfigurationError',
      message: 'API_KEY environment variable is not set',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const provided = req.headers['x-api-key'];

  if (!provided || typeof provided !== 'string') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header',
      statusCode: 401,
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(provided, apiKey)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
      statusCode: 403,
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  next();
}

/**
 * Simple constant-time string comparison that prevents timing attacks.
 * Both strings are compared character-by-character regardless of early mismatches.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid length-based timing leaks
    let result = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return result === 0;
}
