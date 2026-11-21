// ============================================================
// src/middleware/rateLimiter.ts — 100 req/min per IP
// ============================================================
import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'RATE_LIMITED',
    message: 'Too many requests from this IP, please try again after 1 minute.',
  },
  skipSuccessfulRequests: false,
});

// Stricter limiter for analysis endpoint (expensive AI calls)
export const analysisRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180, // allows frequent 1s-5s auto-refresh cycles
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'RATE_LIMITED',
    message: 'Analysis requests limited to 180 per minute. Please wait.',
  },
});
