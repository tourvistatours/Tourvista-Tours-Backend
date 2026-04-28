import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter with improved security and flexibility
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit per IP

  standardHeaders: true, // adds RateLimit-* headers
  legacyHeaders: false, // disables X-RateLimit-* headers

  message: {
    statusCode: 429,
    message: 'Too many requests. Please try again later.',
  },

  skip: (req: Request) => {
    return req.path === '/api/health';
  },

  // More accurate IP handling (important behind proxies like Vercel/Nginx)
  keyGenerator: (req: Request) => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});
