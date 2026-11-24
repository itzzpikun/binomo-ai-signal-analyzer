// ============================================================
// src/routes/backtest.routes.ts
// ============================================================
import { Router } from 'express';
import { body } from 'express-validator';
import backtestController from '../controllers/backtest.controller';
import { analysisRateLimiter } from '../middleware/rateLimiter';
import { isValidSymbol, VALID_INTERVALS } from '../services/marketData.service';

const router = Router();

// POST /api/backtest/run
router.post(
  '/run',
  analysisRateLimiter,
  [
    body('symbol')
      .notEmpty()
      .isString()
      .trim()
      .custom((val) => {
        if (!isValidSymbol(val)) {
          throw new Error(`Unsupported symbol: ${val}`);
        }
        return true;
      }),
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
