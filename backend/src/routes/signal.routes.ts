// ============================================================
// src/routes/signal.routes.ts
// ============================================================
import { Router } from 'express';
import { body, query } from 'express-validator';
import signalController from '../controllers/signal.controller';
import { analysisRateLimiter } from '../middleware/rateLimiter';

const router = Router();

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
      .withMessage('symbol is required'),
    body('interval')
      .notEmpty()
      .isIn(VALID_INTERVALS)
      .withMessage('interval must be 1min, 5min, or 15min'),
    body('candles')
      .isArray({ min: 5 })
      .withMessage('candles must be an array with at least 5 entries'),
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
      .withMessage('symbol must be a string'),
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
