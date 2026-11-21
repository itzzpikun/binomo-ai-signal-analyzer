// ============================================================
// src/routes/backtest.routes.ts
// ============================================================
import { Router } from 'express';
import { body } from 'express-validator';
import backtestController from '../controllers/backtest.controller';
import { analysisRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const VALID_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD',
  'BTC/USD', 'ETH/USD', 'XAU/USD', 'US30', 'NAS100',
];
const VALID_INTERVALS = ['1min', '5min', '15min'];

// POST /api/backtest/run
router.post(
  '/run',
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
    body('startDate')
      .notEmpty()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('endDate')
      .notEmpty()
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date')
      .custom((endDate: string, { req }) => {
        const reqBody = req.body as { startDate?: string };
        if (reqBody.startDate && new Date(endDate) <= new Date(reqBody.startDate)) {
          throw new Error('endDate must be after startDate');
        }
        return true;
      }),
    body('indicators')
      .optional()
      .isArray()
      .withMessage('indicators must be an array of strings'),
    body('indicators.*')
      .optional()
      .isString()
      .isIn(['RSI', 'MACD', 'BB', 'EMA9', 'EMA21', 'STOCH', 'ATR'])
      .withMessage('Invalid indicator'),
  ],
  backtestController.run.bind(backtestController)
);

export default router;
