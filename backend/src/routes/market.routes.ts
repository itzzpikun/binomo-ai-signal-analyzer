// ============================================================
// src/routes/market.routes.ts
// ============================================================
import { Router } from 'express';
import { query } from 'express-validator';
import marketController from '../controllers/market.controller';
import { isValidSymbol, VALID_INTERVALS } from '../services/marketData.service';

const router = Router();

// GET /api/market/candles?symbol=EUR/USD&interval=5min&outputsize=100
router.get(
  '/candles',
  [
    query('symbol')
      .optional()
      .isString()
      .trim()
      .custom((val) => {
        if (!isValidSymbol(val)) {
          throw new Error(`Unsupported symbol: ${val}`);
        }
        return true;
      }),
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
      .custom((val) => {
        if (!isValidSymbol(val)) {
          throw new Error(`Unsupported symbol: ${val}`);
        }
        return true;
      }),
  ],
  marketController.getPrice.bind(marketController)
);

// GET /api/market/status
router.get('/status', marketController.getStatus.bind(marketController));

export default router;
