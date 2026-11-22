// ============================================================
// src/routes/performance.routes.ts
// ============================================================
import { Router } from 'express';
import { param } from 'express-validator';
import performanceController from '../controllers/performance.controller';

const router = Router();

const VALID_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD',
  'BTC/USD', 'ETH/USD', 'XAU/USD', 'US30', 'NAS100', 'CRYPTO_IDX',
];

// GET /api/performance/summary
router.get('/summary', performanceController.getSummary.bind(performanceController));

// GET /api/performance/:symbol
router.get(
  '/:symbol',
  [
    param('symbol')
      .isString()
      .trim()
      .toUpperCase()
      .isIn(VALID_SYMBOLS)
      .withMessage(`symbol must be one of: ${VALID_SYMBOLS.join(', ')}`),
  ],
  performanceController.getBySymbol.bind(performanceController)
);

export default router;
