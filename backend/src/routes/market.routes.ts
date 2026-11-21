// ============================================================
// src/routes/market.routes.ts
// ============================================================
import { Router } from 'express';
import { query } from 'express-validator';
import marketController from '../controllers/market.controller';

const router = Router();

const VALID_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD',
  'BTC/USD', 'ETH/USD', 'XAU/USD', 'US30', 'NAS100',
];
const VALID_INTERVALS = ['1min', '5min', '15min'];

// GET /api/market/candles?symbol=EUR/USD&interval=5min&outputsize=100
router.get(
  '/candles',
  [
    query('symbol')
      .optional()
      .isString()
      .trim()
      .toUpperCase()
      .isIn(VALID_SYMBOLS)
      .withMessage(`symbol must be one of: ${VALID_SYMBOLS.join(', ')}`),
    query('interval')
      .optional()
      .isString()
      .isIn(VALID_INTERVALS)
      .withMessage('interval must be 1min, 5min, or 15min'),
    query('outputsize')
      .optional()
      .isInt({ min: 1, max: 5000 })
      .withMessage('outputsize must be between 1 and 5000'),
  ],
  marketController.getCandles.bind(marketController)
);

// GET /api/market/assets
router.get('/assets', marketController.getAssets.bind(marketController));

// GET /api/market/price?symbol=EUR/USD
router.get(
  '/price',
  [
    query('symbol')
      .notEmpty()
      .isString()
      .trim()
      .toUpperCase()
      .isIn(VALID_SYMBOLS)
      .withMessage(`symbol must be one of: ${VALID_SYMBOLS.join(', ')}`),
  ],
  marketController.getPrice.bind(marketController)
);

// GET /api/market/status
router.get('/status', marketController.getStatus.bind(marketController));

export default router;
