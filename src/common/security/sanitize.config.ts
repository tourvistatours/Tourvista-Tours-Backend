import { Request, Response, NextFunction } from 'express';

export function sanitizeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    sanitizeInPlace(req.query);
  }

  next();
}

/**
 * Recursively sanitize any input (object, array, string)
 */
function sanitizeObject(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeObject);
  }

  if (input !== null && typeof input === 'object') {
    const clean: Record<string, any> = {};

    for (const key of Object.keys(input)) {
      clean[key] = sanitizeObject(input[key]);
    }

    return clean;
  }

  return input;
}

/**
 * Recursively sanitize any input (object, array, string)
 */
function sanitizeInPlace(obj: any) {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (typeof value === 'string') {
      obj[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      obj[key] = value.map((v) =>
        typeof v === 'string' ? sanitizeString(v) : v,
      );
    } else if (value && typeof value === 'object') {
      sanitizeInPlace(value);
    }
  }
}

/**
 * String-level sanitization (safe + minimal destructive logic)
 */
function sanitizeString(value: string): string {
  return value
    .replace(/<script.*?>.*?<\/script>/gi, '') // remove script blocks
    .replace(/javascript:/gi, '') // remove JS protocol
    .replace(/on\w+\s*=\s*".*?"/gi, '') // remove inline event handlers
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .trim();
}
