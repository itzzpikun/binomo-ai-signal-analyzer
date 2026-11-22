// ============================================================
// src/routes/signal.routes.ts
// ============================================================
import { Router } from 'express';
import { body, query } from 'express-validator';
import signalController from '../controllers/signal.controller';
import { analysisRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const VALID_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD',
  'BTC/USD', 'ETH/USD', 'XAU/USD', 'US30', 'NAS100', 'CRYPTO_IDX',
];
const VALID_INTERVALS = ['1min', '5min', '15min'];

// POST /api/signal/analyze
router.post(
  '/analyze',
  analysisRateLimiter,
  [
    body('symbol')
      .notEmpty()
      .isString()
      .trim()
      .toUpperCase()
      .isIn(VALID_SYMBOLS)
      .withMessage(`symbol must be one of: ${VALID_SYMBOLS.join(', ')}`),
    body('interval')
      .notEmpty()
      .isIn(VALID_INTERVALS)
      .withMessage('interval must be 1min, 5min, or 15min'),
    body('candles')
      .isArray({ min: 10 })
      .withMessage('candles must be an array with at least 10 entries'),
    body('candles.*.open').isFloat({ min: 0 }).withMessage('open must be a positive number'),
    body('candles.*.high').isFloat({ min: 0 }).withMessage('high must be a positive number'),
    body('candles.*.low').isFloat({ min: 0 }).withMessage('low must be a positive number'),
    body('candles.*.close').isFloat({ min: 0 }).withMessage('close must be a positive number'),
  ],
  signalController.analyze.bind(signalController)
);

// GET /api/signal/history?symbol=EUR/USD&limit=50
router.get(
  '/history',
  [
    query('symbol')
      .optional()
      .isString()
      .trim()
      .toUpperCase()
      .isIn(VALID_SYMBOLS)
      .withMessage(`symbol must be one of: ${VALID_SYMBOLS.join(', ')}`),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('limit must be between 1 and 200'),
  ],
  signalController.getHistory.bind(signalController)
);

// POST /api/signal/verify
router.post(
  '/verify',
  [
    body('signalId').notEmpty().isString().withMessage('signalId is required'),
    body('entryPrice').isFloat({ min: 0 }).withMessage('entryPrice must be a positive number'),
    body('exitPrice').isFloat({ min: 0 }).withMessage('exitPrice must be a positive number'),
  ],
  signalController.verify.bind(signalController)
);

export default router;
